import React from "react";
import { Outlet } from "react-router-dom";
import { Box, ThemeProvider, createTheme } from '@mui/material';
import Header from "./Header";

const defaultTheme = createTheme(
    {
        typography: {
            fontSize: 12,
            fontFamily: [
                'Poppins',
                'sans-serif',
            ].join(','),
        },
    },
);

export default function LandingLayout() {
    const footerRef = React.useRef(null);
    return (
        <ThemeProvider theme={defaultTheme}>
            <Box sx={{ position: "relative", height: '100%', maxHeight: '100vh', overflowY: "auto", width: "100vw" }} >
                <Box width={"100%"} sx={{
                    position: "absolute", zIndex: 1,
                    pl: { xs: 1, sm: 2, lg: 4 }, pr: { xs: 1, lg: 3 }
                }}>
                    <Header footerRef={footerRef} />
                </Box>
                <Outlet />
            </Box>
        </ThemeProvider>
    );
}