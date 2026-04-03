# Grammar AI

A professional, open-source grammar and style checker powered by Google's Gemini AI. This application features a sleek dark theme, multi-format file support (PDF, DOCX, TXT), and a private local history.

## Features

- **AI-Powered Corrections**: Uses Gemini 3.1 Flash Lite for high-speed, accurate grammar and style suggestions.
- **File Upload Support**: Extract text directly from PDF, DOCX, and TXT files.
- **Local History**: All corrections are saved securely in your browser's IndexedDB.
- **Private & Secure**: Your data stays on your device. Use your own Gemini API key or connect to a Local AI server.
- **Modern Dark UI**: A refined, editorial interface designed for focus.

## Installation & Setup

Follow these steps to get Grammar AI running on your local machine:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/grammar-ai.git
   ```

2. **Navigate to the Directory**
   ```bash
   cd grammar-ai
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

Once the server is running, open your browser and navigate to `http://localhost:3000`.

## Configuration

To use the AI features, you will need to configure an API source in the **Settings** (⚙️) menu:
- **Gemini API**: Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
- **Local AI**: Connect to an OpenAI-compatible server like LM Studio or Ollama.

## License

MIT
