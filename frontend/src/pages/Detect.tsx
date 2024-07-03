import React, { useEffect, useRef, useState } from 'react';
import { Button, Typography, Box, Grid, CircularProgress } from '@mui/material';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatBox } from '../components/chat/ChatBox';
import { ChatInput } from "../components/chat/ChatInput";
import styled from 'styled-components';
import ReconnectingWebSocket from "reconnecting-websocket";
import { Message } from "../data/Message";
import { ChatMenu } from "../components/chat/debug/ChatMenu";
import { DebugDrawer } from "../components/chat/debug/DebugDrawer";


import ImageIcon from '@mui/icons-material/Image';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

function DetectTumor() {
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [processImages, setProcessImages] = useState([]);
  const [buttonText, setButtonText] = useState('MRI Görüntüsü Yükle');
  const [showResult, setShowResult] = useState(false);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [detectionResult, setDetectionResult] = useState('');

   const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const webSocket = useRef<ReconnectingWebSocket | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string>("");
  const [debugMode, setDebugMode] = useState<boolean>(false);

  const [resultImage, setResultImage] = useState<string | null>(null);
  const [file, setFile] = useState<any>(null);

  const onDrop = (acceptedFiles: any) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
  };

  //@ts-ignore
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: '.nii,.nii.gz' });
  // Set up websocket connection when currentChatId changes
  useEffect(() => {
    if (currentChatId) {
      webSocket.current = new ReconnectingWebSocket(`ws://localhost:8000/ws/chat/${currentChatId}/`);
      webSocket.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "debug") {
          // Debug message received. Replace newline characters with <br /> tags
          const formattedToken = data.message.replace(/\n/g, '<br />');
          setDebugMessage(prevMessage => prevMessage + formattedToken);
        } else {
          // Entire message received
          setLoading(false)
          const newMessage = {sender: 'AI', content: data['message']};
          
          setMessages(prevMessages => [...prevMessages, newMessage]);
        }
      };

      webSocket.current.onclose = () => {
        console.error('Chat socket closed unexpectedly');
      };
      // Fetch chat messages for currentChatId
      fetchMessages(currentChatId)
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
        handleUpload();
      };
      reader.readAsDataURL(file);
      setButtonText('MRI Görüntüsü İşle');
    } else {
      setButtonText('MRI Görüntüsü Yükle');
    }
  }, [file]);

  const onChatSelected = (chatId: string | null) => {
    if (currentChatId === chatId) return; // Prevent unnecessary re-renders.
    if (chatId == null) {
      // Clear messages if no chat is selected
      setMessages([])
    }
    setCurrentChatId(chatId);
  };

  const onNewUserMessage = (chatId: string, message: Message) => {
    webSocket.current?.send(
      JSON.stringify({
        message: message.content,
        chat_id: chatId,
      })
    );
    setMessages(prevMessages => [...prevMessages, message]);
    setLoading(true); // Set loading to true when sending a message
  };

  const onNewChatCreated = (chatId: string) => {
    onChatSelected(chatId)
  };

  const fetchMessages = (currentChatId: string | null) => {
    fetch(`http://localhost:8000/api/chats/${currentChatId}/messages/`)
      .then(response => response.json())
      .then(data => {
        setMessages(data)
      });
  }

  const handleUpload = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 5 seconds
    setLoading(false);
    setResult('Tumor Detected');
    setResultImage('result.png');
    sendMessageToChat("The brain tumor detected in the MRI is located at coordinates 100 x 150. The tumor size is approximately 2000 square pixels, with a width of 50 pixels and a height of 40 pixels. can you give any info about it use yourmedical info what kind of tumor this would be");

    // const formData = new FormData();
    // formData.append('file', file);

    // try {
    //   const response = await axios.post('http://127.0.0.1:5000/upload', formData, {
    //     headers: {
    //       'Content-Type': 'multipart/form-data'
    //     }
    //   });
    //   return response.data.filepath;
    // } catch (error) {
    //   console.error('Error uploading file:', error);
    // }
  };

  const sendMessageToChat = (message: string) => {
    if (currentChatId) {
      const newMessage: Message = { sender: 'User', content: message };
      onNewUserMessage(currentChatId, newMessage);
    }
  };

  const handleDetect = async () => {
    const filepath = await handleUpload();
    try {
      const response = await axios.post('http://127.0.0.1:5000/detect', { filepath });
      setResult(response.data.result);
    } catch (error) {
      console.error('Error detecting tumor:', error);
    }
  };

  const handleProcess = () => {
    handleDetect();
    setProcessImages([]);
    setShowResult(true);
    setShowSaveButton(true);
  };

  const handleSaveResult = () => {
    // Sonuç kaydetme işlemi
    console.log('Sonuç kaydedildi:', result);
    alert('Sonuç başarıyla kaydedildi!');
  };

  return (
      <Grid container direction="row" alignItems={"start"} >
      <Grid item xs={6} px={3} pt={2}>
      <Grid container direction="column" alignItems={"center"} >
          
          <Grid item xs={12} textAlign={"center"}>
            <Typography variant="h4" style={{ color: '#666666' }}>Analyze</Typography>
            <div {...getRootProps({ style: { border: '2px dashed #eeeeee', padding: '20px', textAlign: 'center' } })}>
              <input {...getInputProps() as React.InputHTMLAttributes<HTMLInputElement>} />
              {file ? (
                <Typography variant="body2">
                  Selected file: testimage
                </Typography>
              ) : (
                <div style={{ padding: '50px 0' }}>
                  <ImageIcon style={{ fontSize: '64px', color: '#cccccc' }} />
                  <Typography variant="h6" style={{ color: '#cccccc' }}>
                    Drag & drop a file here, or click to select one
                  </Typography>
                </div>
              )}
            </div>
          </Grid>

          <Grid item xs={12} textAlign={"center"} p={2}>
            {inputImage && <img src={inputImage} width={"100%"} alt="Input MRI" />}
          </Grid>

          <Grid item xs={12} textAlign={"center"}>
            {showResult && (
              <>
                <div className="result">
                  <Typography variant="h6">{result}</Typography>
                </div>
                {processImages.map((img, index) => (
                  <img key={index} src={img} alt={`Process step ${index + 1}`} />
                ))}
                {showSaveButton && (
                  <Button
                    type="button"
                    fullWidth
                    variant="contained"
                    color="secondary"
                    sx={{ mt: 3, mb: 2, width: '200px', backgroundColor: '#4CAF50' }}
                    onClick={handleSaveResult}
                  >
                    Sonucu Kaydet
                  </Button>
                )}
              </>
            )}
          </Grid>
          
          <Grid item xs={12} textAlign={"center"} p={2}>
            {loading ? (
              <CircularProgress />
            ) : (
              resultImage && <img src={resultImage} width={"100%"} alt="Result MRI" />
            )}
          </Grid>
            
        </Grid>
      </Grid>

      <Grid item xs={6}>
      <AppContainer>
          <Sidebar onChatSelected={onChatSelected} selectedChatId={currentChatId} />
          <ChatContainer debugMode={debugMode}>
            <ChatMenu debugMode={debugMode} setDebugMode={setDebugMode} />
            <ChatBox messages={messages} isLoading={loading} />
            <ChatInput onNewUserMessage={onNewUserMessage} onNewChatCreated={onNewChatCreated} chatId={currentChatId} />
          </ChatContainer>
          {debugMode && <DebugDrawer message={debugMessage} debugMode={debugMode} />}
        </AppContainer>
      </Grid>
      </Grid>
  );
}

const AppContainer = styled.div`
  display: flex;
  width: 50vw;
  height: 90vh;
`;

const ChatContainer = styled.div<{ debugMode: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${({debugMode}) => debugMode ? '70%' : '100%'};
  transition: all 0.2s; // Smooth transition
  width: ${({ debugMode }) => debugMode ? '70%' : '100%'};
  transition: all 0.2s;
  height: 100%;
`;

export default DetectTumor;
