import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export async function transcribeVoice(audioPath: string): Promise<string> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'en', // Can be auto-detected, or specify 'sk', 'de', etc.
    });
    
    return transcription.text;
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
}

export async function transcribeFromUrl(fileUrl: string): Promise<string> {
  const tempDir = '/tmp';
  const tempFile = path.join(tempDir, `voice_${Date.now()}.ogg`);
  
  try {
    await downloadFile(fileUrl, tempFile);
    const text = await transcribeVoice(tempFile);
    return text;
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(tempFile);
    } catch {}
  }
}
