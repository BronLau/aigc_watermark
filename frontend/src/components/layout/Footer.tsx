import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Link, 
  Divider 
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import InfoIcon from '@mui/icons-material/Info';

const Footer: React.FC = () => {
  return (
    <Box 
      component="footer" 
      sx={{ 
        py: 3, 
        px: 2, 
        mt: 'auto', 
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Container maxWidth="lg">
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center'
          }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            {'Copyright © '}
            <Link color="inherit" href="/">
              AIGC水印标识系统
            </Link>{' '}
            {new Date().getFullYear()}
            {'. 符合中国工信部《人工智能生成合成内容标识办法》'}
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            mt: { xs: 2, sm: 0 } 
          }}>
            <Link
              href="https://github.com/"
              color="inherit"
              target="_blank"
              rel="noopener"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <GitHubIcon sx={{ mr: 0.5 }} fontSize="small" />
              <Typography variant="body2">GitHub</Typography>
            </Link>
            <Link
              href="/about"
              color="inherit"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <InfoIcon sx={{ mr: 0.5 }} fontSize="small" />
              <Typography variant="body2">关于</Typography>
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer; 