import React, { useState, useEffect } from 'react';

const KB_FILES = [
  'WILL%20DATABASE/WILL%20PART%20I%20SR%20GR.txt',
  'WILL%20DATABASE/WILL%20PART%20II%20COSMO%20.txt',
  'WILL%20DATABASE/WILL%20PART%20III%20QM%20.txt'
];

const MAX_KB_CHARS = 30000;        // ← ограничиваем размер вставляемой базы

async function loadKnowledge() {
  const base = 'https://raw.githubusercontent.com/AntonRize/WILL/main/';
  const texts = await Promise.all(
    KB_FILES.map(path => fetch(base + path).then(r => r.text()))
  );
  return texts.join('\n');
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [knowledge, setKnowledge] = useState('');

  useEffect(() => { loadKnowledge().then(setKnowledge); }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');

    const prompt = `${input}\n\nKnowledge:\n${knowledge.slice(0, MAX_KB_CHARS)}`;

    const res   = await fetch('https://proxy-flame-seven.vercel.app/api/gemini', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ prompt })
    });

    const data  = await res.json();
    setMessages(m => [...m, { role: 'assistant', content: data.reply || data.error }]);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>WILL AI Assistant</h1>

      {messages.map((m, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <strong>{m.role === 'user' ? 'You' : 'AI'}:</strong> {m.content}
        </div>
      ))}

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' ? sendMessage() : null}
        placeholder="Ask something..."
        style={{ width: '80%', marginRight: 8 }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
