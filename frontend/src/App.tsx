// App.tsx

import React, { useEffect, useRef, useState } from 'react';
import Home from "./pages/Home";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Box, Container, AppBar, Toolbar, Typography, Button } from "@mui/material";
// import DetectTumor from "./pages/detectTumor";
import UserSignup from './pages/UserSignup';
import UserSignin from './pages/UserSignin';
import Detect from './pages/Detect';
import UserPics from './pages/UserPics';

export const App = () => {
 
  return (
    <>
    <BrowserRouter>
        <AppBar position="static"sx={{ backgroundColor: '#191970' }} >
          <Toolbar>
            <Typography variant="h6" component="div" fontWeight={"bold"}
            sx={{ flexGrow: 1, 
              background: 'linear-gradient(to bottom , #2196F3, #eff3f2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',  }}>
              NeuroVision
            </Typography>
            <Button color="inherit" component={Link} to="/home">Home</Button>
            <Button color="inherit" component={Link} to="/detect">detect tumor</Button>
            <Button color="inherit" component={Link} to="/userpics">user pics</Button>
          </Toolbar>
        </AppBar>
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/UserSignin" element={<UserSignin />} />
            <Route path="/UserSignup" element={<UserSignup />} />
            <Route path="/detect" element={<Detect />} />
            <Route path="/userpics" element={<UserPics />} />
          </Routes>
      </BrowserRouter>
    </>
  );
};
