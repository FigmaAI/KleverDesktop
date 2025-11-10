import React from 'react';
import Box from '@mui/joy/Box';
import Container from '@mui/joy/Container';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import AddIcon from '@mui/icons-material/Add';

function ProjectList() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography level="h2">Projects</Typography>
        <Button startDecorator={<AddIcon />} variant="solid">
          New Project
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography level="body-md" color="neutral" sx={{ textAlign: 'center', py: 8 }}>
            No projects yet. Create your first project to get started!
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}

export default ProjectList;
