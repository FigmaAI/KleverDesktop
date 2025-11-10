import React, { useState } from 'react';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import Tabs from '@mui/joy/Tabs';
import TabList from '@mui/joy/TabList';
import Tab from '@mui/joy/Tab';
import TabPanel from '@mui/joy/TabPanel';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';

interface ModelCheckProps {
  onComplete: () => void;
  onBack: () => void;
}

function ModelCheck({ onComplete, onBack }: ModelCheckProps) {
  const [modelType, setModelType] = useState<'ollama' | 'api'>('ollama');
  const [ollamaModel, setOllamaModel] = useState('qwen3-vl:4b');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleContinue = () => {
    // TODO: Validate and save configuration
    onComplete();
  };

  return (
    <Box>
      <Typography level="h4" sx={{ mb: 2 }}>
        Model Configuration
      </Typography>
      <Typography level="body-sm" sx={{ mb: 3 }}>
        Choose how you want to run AI models: locally with Ollama or via API
      </Typography>

      <Tabs value={modelType} onChange={(e, value) => setModelType(value as 'ollama' | 'api')}>
        <TabList>
          <Tab value="ollama">Local Ollama (Recommended)</Tab>
          <Tab value="api">Remote API</Tab>
        </TabList>

        <TabPanel value="ollama" sx={{ p: 3 }}>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Ollama Model</FormLabel>
            <Select
              value={ollamaModel}
              onChange={(e, value) => setOllamaModel(value as string)}
            >
              <Option value="qwen3-vl:4b">qwen3-vl:4b (4B, Recommended for 16GB RAM)</Option>
              <Option value="qwen2.5-vl:7b">qwen2.5-vl:7b (7B, Requires 24GB RAM)</Option>
              <Option value="llava:7b">llava:7b (7B)</Option>
            </Select>
          </FormControl>

          <Typography level="body-sm" color="neutral">
            Make sure Ollama is running and the model is downloaded
          </Typography>
        </TabPanel>

        <TabPanel value="api" sx={{ p: 3 }}>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel>API Base URL</FormLabel>
            <Input
              placeholder="https://api.openai.com/v1/chat/completions"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </FormControl>

          <FormControl sx={{ mb: 2 }}>
            <FormLabel>API Key</FormLabel>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </FormControl>
        </TabPanel>
      </Tabs>

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button fullWidth variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button fullWidth variant="solid" onClick={handleContinue}>
          Continue
        </Button>
      </Box>
    </Box>
  );
}

export default ModelCheck;
