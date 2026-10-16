import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react';
import { 
  INITIAL_CHAT_MESSAGES, 
  SUGGESTED_PROMPTS, 
  SCENARIO_CHIPS, 
  generateChatbotResponse 
} from '../services/chatbotData';
import { getModelCard } from '../services/api';

export default function AIChatbotView({ patient, isLive }) {
  const [messages, setMessages] = useState(INITIAL_CHAT_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [modelCard, setModelCard] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    getModelCard()
      .then(card => {
        if (isMounted) setModelCard(card);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query || !query.trim()) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: query
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await generateChatbotResponse(query, patient, modelCard);
      const botMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: response.text
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: "Unable to process query."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      {/* Top Banner - always visible */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        fontSize: '0.85rem',
        color: '#1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        fontWeight: 500
      }}>
        <AlertCircle size={18} color="#0284c7" style={{ flexShrink: 0 }} />
        <span>
          Scripted assistant. It answers questions about this app, this patient's own data, and what-if scenarios. No medical advice. Not connected to a language model.
        </span>
      </div>

      {/* Header */}
      <div className="clean-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-blue-subtle)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Data & Scenario Assistant
              </h1>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {patient ? `Viewing records for ${patient.name || patient.id}` : 'No patient selected'}
              </div>
            </div>
          </div>

          <span style={{
            fontSize: '0.75rem',
            padding: '3px 9px',
            borderRadius: 'var(--radius-full)',
            background: '#f1f5f9',
            color: '#475569',
            fontWeight: 600
          }}>
            Scripted Assistant
          </span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {SUGGESTED_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              background: '#ffffff',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all var(--transition)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Sparkles size={12} color="var(--primary-blue)" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Log Area */}
      <div className="clean-card" style={{
        minHeight: '380px',
        maxHeight: '480px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        background: '#ffffff',
        marginBottom: '1rem'
      }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%'
            }}
          >
            {msg.sender === 'bot' && (
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                background: 'var(--primary-blue-subtle)',
                color: 'var(--primary-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Bot size={16} />
              </div>
            )}

            <div style={{
              background: msg.sender === 'user' ? 'var(--primary-blue)' : '#f8fafc',
              color: msg.sender === 'user' ? '#ffffff' : 'var(--text-main)',
              border: msg.sender === 'user' ? 'none' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.85rem 1.15rem',
              fontSize: '0.85rem',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              boxShadow: 'var(--shadow-subtle)'
            }}>
              {msg.text}
              <div style={{
                fontSize: '0.68rem',
                color: msg.sender === 'user' ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                marginTop: '0.4rem',
                textAlign: 'right'
              }}>
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-full)',
                background: '#e2e8f0',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontWeight: 700,
                fontSize: '0.75rem'
              }}>
                YOU
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <Bot size={16} color="var(--primary-blue)" />
            <span>Retrieving recorded data...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          placeholder="Ask about your recorded data, terms, or run a what-if scenario..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          style={{
            flex: 1,
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: '#ffffff',
            border: '1.5px solid var(--border-medium)',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            outline: 'none',
            boxShadow: 'var(--shadow-subtle)'
          }}
        />

        <button
          className="btn-clean btn-clean-primary"
          onClick={() => handleSend()}
          style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem' }}
        >
          <Send size={15} /> Send Query
        </button>
      </div>

      {/* Scenario Chips (buttons under the input) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.25rem' }}>
          What-if scenarios:
        </span>
        {SCENARIO_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip.query)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              background: '#f8fafc',
              border: '1px solid var(--border-light)',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-blue)';
              e.currentTarget.style.background = '#f0f9ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.background = '#f8fafc';
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
