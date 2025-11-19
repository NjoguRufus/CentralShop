import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyAlAPAqvpVLczCfWQZFVWzH3NC1q1okRDM';
const genAI = new GoogleGenerativeAI(API_KEY);

export const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const generateResponse = async (prompt: string, context?: any): Promise<string> => {
  try {
    const contextualPrompt = context 
      ? `Context: ${JSON.stringify(context)}\n\nUser Question: ${prompt}\n\nPlease provide a helpful response based on the context provided.`
      : prompt;
    
    const result = await model.generateContent(contextualPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw new Error('Failed to generate AI response');
  }
};