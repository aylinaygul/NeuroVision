
import React, { useEffect, useRef, useState } from 'react';
import { Button, Typography, Box, Grid, CircularProgress,  ImageList, ImageListItem } from '@mui/material';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatBox } from '../components/chat/ChatBox';
import { ChatInput } from "../components/chat/ChatInput";
import ReconnectingWebSocket from "reconnecting-websocket";
import { Message } from "../data/Message";
import { ChatMenu } from "../components/chat/debug/ChatMenu";
import { DebugDrawer } from "../components/chat/debug/DebugDrawer";
import ImageIcon from '@mui/icons-material/Image';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { styled } from '@mui/system';


const BackgroundImageBox = styled(Box)(({ theme }) => ({
    width: '100%',
    gap: 2,
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right',
    backgroundImage: 'url(/Brain_2_1.png)',
    height: '100vh',
    opacity: 0.4,
}));

function Item(props:any) {
  const { sx, icon, header, text, image, children, ...other } = props;
  return (
      <Box
          sx={{
              backgroundColor: '#FAFAFA',
              border: '1px solid #EEEEEE',
              p: 3,
              borderRadius: 2,
              textAlign: 'start',
              position: 'relative',
              overflow: 'hidden',
              ...sx,
          }}
          {...other}
      >
          {children ?? <Grid container spacing={1} sx={{ flexDirection: { xs: "row", lg: "column" }, alignItems: { xs: "center", lg: "normal" }, justifyContent: "center" }}>
              <Grid item xs={3} lg={6}>
                  {icon}
              </Grid>
              <Grid item xs={9} lg={12}>
                  <Typography variant="body1" fontWeight={'600'}>{header}</Typography>
                  {props.additionalcontent ?? null}
                  <Typography variant="caption" color={"#9E9E9E"}>{text}</Typography>
              </Grid>
          </Grid>}
      </Box>
  );
}

function Text(props:any) {
  const { xs, sm, md, lg, color, fontWeight, text, ...other } = props;
  return <Typography sx={{ typography: { xs: xs ?? "none", sm: sm ?? "none", md: md ?? "none", lg: lg ?? "none" }, ...other }} color={color ?? "black"}>
      <Box fontWeight={fontWeight ?? "bold"}>{text}</Box></Typography>
}

function SubText(props:any) {
  const { text, ...other } = props;
  return <Text xs="caption" s="body2" md="body1" color={"#9E9E9E"} fontWeight="normal" pb={1} text={text} />
}


function Home() {
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
      id = newChat.id;
      const newMessage: Message = { sender: 'User', content: message };
    onNewUserMessage(id, newMessage);

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
    <Box bgcolor={"background.default"}>
    <BackgroundImageBox position={"absolute"} />
    <Box position={"relative"} sx={{ display: 'grid', gridAutoFlow: "row", gridTemplateColumns: { xs: '1fr', md: '1fr 4fr 6fr 1fr' }, gridTemplateRows: { xs: '1fr 1fr 5fr', sm: '1fr 2fr 10fr', md: '1fr 4fr 1fr' }, gap: 2, alignItems: "center" }}>
        <Box sx={{ gridArea: { xs: '2 / 1 / 3 / 2', md: '2 / 2 / 3 / 3' }, textAlign: { xs: "center", md: "start" } }}>
            <Typography sx={{ typography: { xs: "body1", sm: "h5", md: "h4", lg: "h3" }, color: { xs: "white", md: '#01579B' } }}>Visualize, Detect, Discuss</Typography>
            <Typography
                sx={{
                    typography: { xs: "h5", sm: "h3", lg: "h2" },
                    background: 'linear-gradient(to bottom, #A2EAE4 , #2196F3, #9B5BE6)',
                    backgroundClip: 'text',
                    color: { xs: 'white', md: 'transparent' },
                    display: 'inline-block',
                }}><Box fontWeight={'800'}>NeuroVision</Box></Typography></Box>
        <Box sx={{ gridArea: { xs: '3 / 1 / 4 / 2', md: "2 / 3 / 3 / 4" } }} >
            <Box component="img" src={'/landingimages/dashboard-image.png'} width={"100%"} />
        </Box>
    </Box>
</Box>
  );
}

export default Home;  // Varsayılan export
