import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';

import theme from './theme';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import TextWatermarkPage from './pages/TextWatermarkPage';
import ImageWatermarkPage from './pages/ImageWatermarkPage';
import InvisibleWatermarkPage from './pages/InvisibleWatermarkPage';
import ExtractWatermarkPage from './pages/ExtractWatermarkPage';
import BatchProcessPage from './pages/BatchProcessPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Header />
        <Container maxWidth="lg" sx={{ py: 4, minHeight: 'calc(100vh - 120px)' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/text-watermark" element={<TextWatermarkPage />} />
            <Route path="/image-watermark" element={<ImageWatermarkPage />} />
            <Route path="/invisible-watermark" element={<InvisibleWatermarkPage />} />
            <Route path="/extract-watermark" element={<ExtractWatermarkPage />} />
            <Route path="/batch-process" element={<BatchProcessPage />} />
          </Routes>
        </Container>
        <Footer />
      </Router>
    </ThemeProvider>
  );
}

export default App; 