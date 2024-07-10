import React, { useEffect, useRef, useState } from 'react';
import { Button, Typography, Box, Grid, CircularProgress } from '@mui/material';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatBox } from '../components/chat/ChatBox';
import { ChatInput } from "../components/chat/ChatInput";
import styled, { keyframes } from 'styled-components';
import ReconnectingWebSocket from "reconnecting-websocket";
import { Message } from "../data/Message";
import { ChatMenu } from "../components/chat/debug/ChatMenu";
import { DebugDrawer } from "../components/chat/debug/DebugDrawer";
import ImageIcon from '@mui/icons-material/Image';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const GothicBox = styled(Box)`
  background-color: #292b2c;
  color: #f5f5f5;
  border: 2px solid #444;
  box-shadow: 0 0 15px #000;
  padding: 20px;
  margin: 20px 0;
  border-radius: 10px;
  animation: ${fadeIn} 0.5s ease-in-out;
`;

const GothicButton = styled(Button)`
  background-color: #444;
  color: #f5f5f5;
  &:hover {
    background-color: #555;
  }
`;

const RotatingIcon = styled(ImageIcon)`
  font-size: 64px;
  color: #f5f5f5;
  animation: ${rotate} 2s linear infinite;
`;

const BackgroundImageBox = styled(Box)(({ theme }) => ({
  width: '100%',
  gap: 2,
  backgroundSize: 'contain',
  
  backgroundPosition: '10% 70%;',
  backgroundImage: 'url(/Brain_2_1.png)',
  height: '100vh',
  opacity: 0.4,
}));

function DetectTumor() {
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const webSocket = useRef<ReconnectingWebSocket | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>("");
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [file, setFile] = useState<any>(null);
  const [prompt, setPrompt] = useState<string>("");

  const sideRef = useRef<any>(null);

  const onDrop = (acceptedFiles: any) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
  };

  //@ts-ignore
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: '.nii,.nii.gz' });

  useEffect(() => {
    if (currentChatId) {
      webSocket.current = new ReconnectingWebSocket(`ws://localhost:8000/ws/chat/${currentChatId}/`);
      webSocket.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "debug") {
          const formattedToken = data.message.replace(/\n/g, '<br />');
          setDebugMessage(prevMessage => prevMessage + formattedToken);
        } else {
          setChatLoading(false);
          const newMessage = { sender: 'AI', content: data['message'] };
          setMessages(prevMessages => [...prevMessages, newMessage]);
        }
      };
      webSocket.current.onclose = () => {
        console.error('Chat socket closed unexpectedly');
        setChatLoading(false);
      };
      fetchMessages(currentChatId);
    }
    return () => {
      webSocket.current?.close();
    };
  }, [currentChatId]);

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInputImage(reader.result as string);
        handleUpload(file);
      };
      reader.readAsDataURL(file);
    }
  }, [file]);

  const onChatSelected = (chatId: string | null) => {
    if (currentChatId === chatId) return;
    if (chatId == null) {
      setMessages([]);
    }
    setCurrentChatId(chatId);
  };

  const onNewUserMessage = (chatId: string, message: Message) => {
    setChatLoading(true);
    webSocket.current?.send(
      JSON.stringify({
        message: message.content,
        chat_id: chatId,
      })
    );
    setMessages(prevMessages => [...prevMessages, message]);
  };

  const onNewChatCreated = (chatId: string) => {
    onChatSelected(chatId);
  };

  const fetchMessages = async (currentChatId: string | null) => {
    setChatLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/chats/${currentChatId}/messages/`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setChatLoading(false);
    }
  }

  const handleUpload = async (file: any) => {
    setImageLoading(true);
    try {
      const bytes: any = await readFileAsBytes(file);
      const formData = new FormData();
      formData.append('file', new Blob([bytes]));
      formData.append('filename', file.name.split('.')[0]);

      const response = await axios.post('http://127.0.0.1:5000/predict', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Extract image, tumor properties and GPT-3 prompt from response
      const { image, tumor_properties, gpt3_prompt } = response.data;

      // Decode base64 image string to URL
      const imageUrl = `data:image/png;base64,${image}`;
      setPrompt(gpt3_prompt);

      setResultImage(imageUrl); // Display the image
    } catch (error:any) {
      console.error('Error:', error);
      if (error.response) {
        const arrayBuffer = error.response.data;
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arrayBuffer);
        console.log(text);
      }
    } finally {
      setImageLoading(false);
    }
  };

  const readFileAsBytes = (file: any) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          const arrayBuffer = event.target.result;
          if (arrayBuffer instanceof ArrayBuffer) {
            resolve(arrayBuffer);
          } else {
            reject(new Error('Failed to read file as ArrayBuffer.'));
          }
        } else {
          reject(new Error('Failed to read file.'));
        }
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const createNewChat = async (message: string) => {
    var id;
    try {
      const response = await fetch('http://localhost:8000/api/chats/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Chat' }) // Adjust this as necessary.
      });
      const newChat = await response.json();
      sideRef?.current?.fetchChats(); // Fetch all chats to update the sidebar
      onChatSelected(newChat.id); // Select the new chat automatically
      const newMessage: Message = { sender: 'User', content: message };
      onNewUserMessage(newChat.id, newMessage);
      
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
    
    

  };

  const sendMessageToChat = async (message: string) => {
    if (message && currentChatId) {
      const newMessage: Message = { sender: 'User', content: message };
      onNewUserMessage(currentChatId, newMessage);
    } else if (!currentChatId) {
      const newChatId = await createNewChat(message);
        
    }
  };

  const handleSaveResult = () => {
    console.log('Sonuç kaydedildi:', result);
    alert('Sonuç başarıyla kaydedildi!');
  };

  return (
<>
    <Box bgcolor={"background.default"}>
    <BackgroundImageBox position={"absolute"} />
    </Box>
    <Grid container direction="row" alignItems={"end"} pt={15} >
      <Grid item xs={3} px={3} pt={2}>
        <Grid container direction="column" alignItems={"center"} >
          <Grid item xs={12} textAlign={"center"} sx={{zIndex:1}} >
            <Typography
                sx={{
                    typography: { xs: "h1", sm: "h1", lg: "1" },
                    background: 'linear-gradient(to bottom, #01579B , #292FD6, #09B9F6)',
                    backgroundClip: 'text',
                    color: { xs: 'white', md: 'transparent' },
                    display: 'inline-block',
                }}><Box fontWeight={'800'}>Visualize, Detect, Discuss</Box></Typography>
          </Grid>
          <Grid item xs={12} textAlign={"center"} sx={{zIndex:1}} pt={20}>
            <GothicBox {...getRootProps()}>
              <input {...getInputProps() as React.InputHTMLAttributes<HTMLInputElement>} />
              {file ? (
                <div style={{ height: '158px',  width:'380px', textAlign:"center", alignContent:"center"  }}>
                  <RotatingIcon />
                <Typography variant="body2">
                  Selected file: {file.name}
                </Typography>
                </div>
              ) : (
                <div style={{ height: '158px',  width:'380px', textAlign:"center", alignContent:"center"  }}>
                  <RotatingIcon />
                  <Typography variant="h6" style={{ color: '#f5f5f5' }}>
                    Drag & drop a file here, or click to select one
                  </Typography>
                </div>
              )}
            </GothicBox>
          </Grid>
          
        </Grid>
      </Grid>
          
      <Grid item xs={9} >
      <Grid container direction={"column"} >
        <Grid item xs={12}  sx={{zIndex:1}} >
        <AppContainer>
          <Sidebar onChatSelected={onChatSelected} selectedChatId={currentChatId} ref={sideRef}/>
          <ChatContainer debugMode={debugMode}>
            <ChatMenu debugMode={debugMode} setDebugMode={setDebugMode} />
            <ChatBox messages={messages} isLoading={chatLoading} />
            <ChatInput onNewUserMessage={onNewUserMessage} onNewChatCreated={onNewChatCreated} chatId={currentChatId} />
          </ChatContainer>
          {debugMode && <DebugDrawer message={debugMessage} debugMode={debugMode} />}
        </AppContainer>
        </Grid>
        <Grid item xs={12} pt={3}  sx={{zIndex:1}}>
          <Grid container direction={"row"} alignItems={"center"}  >
            
            <Grid item xs={9} >
            {imageLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '225px', width:'990px' }}>
              <CircularProgress style={{ color: '#black' }} />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '225px', width:'990px' }}>
              {resultImage ? <img src={resultImage} height={"100%"} alt="Result MRI" />: 
              <img src='/noimage.png' height={"90%"} alt="No MRI Image" />}
              </Box>
            )}
            </Grid>
            <Grid item xs={3} >
            <Button variant="contained" onClick={() => sendMessageToChat(prompt)} disabled={chatLoading} 
            sx={{bgcolor:"gray", width:"150px",height:"50px"}}>
              Ask GPT
            </Button>
          </Grid>
          </Grid>

      </Grid>
    </Grid>
    
    </Grid>
    
    </Grid>
    </>
    
  );
}

const AppContainer = styled.div`
  display: flex;
  width: 70vw;
  height: 60vh;
  background: #292b2c;
  border: 2px solid #444;
  box-shadow: 0 0 15px #000;
  transform: perspective(1000px);
  animation: ${fadeIn} 0.5s ease-in-out;
`;

const ChatContainer = styled.div<{ debugMode: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${({debugMode}) => debugMode ? '70%' : '100%'};
  transition: all 0.2s;
  height: 100%;
  background: #292b2c;
  color: black;
  border-left: 1px solid #444;
`;

export default DetectTumor;
