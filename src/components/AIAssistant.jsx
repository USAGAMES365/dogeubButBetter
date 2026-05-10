import { useMemo, useState } from 'react';
import { Sparkles, Send, KeyRound } from 'lucide-react';
import clsx from 'clsx';
import { useOptions } from '/src/utils/optionsContext';

const providerConfig = {
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    keyPlaceholder: 'sk-...',
  },
  openrouter: {
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openai/gpt-4o-mini',
    keyPlaceholder: 'sk-or-...',
  },
  gemini: {
    label: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    keyPlaceholder: 'AIza...',
  },
};

const getProvider = (value) => (providerConfig[value] ? value : 'openai');

const allowedHostsByProvider = {
  openai: new Set(['api.openai.com']),
  openrouter: new Set(['openrouter.ai']),
  gemini: new Set(['generativelanguage.googleapis.com']),
};

const AIAssistant = () => {
  const { options, updateOption } = useOptions();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const provider = getProvider(options.aiProvider);
  const defaults = providerConfig[provider];

  const endpoint = options.aiEndpoint || defaults.endpoint;
  const model = options.aiModel || defaults.model;
  const hasKey = Boolean(options.aiApiKey?.trim());
  const requestTimeoutMs = 30000;

  const panelClass = useMemo(
    () => clsx(
      'w-full max-w-[40rem] mx-auto mt-8 rounded-2xl border p-4 backdrop-blur-md',
      options.type === 'dark' ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white/70',
    ),
    [options.type],
  );

  const handleProviderChange = (nextProvider) => {
    const nextConfig = providerConfig[nextProvider];
    const prevProvider = getProvider(options.aiProvider);
    const prevConfig = providerConfig[prevProvider];

    const shouldResetEndpoint = !options.aiEndpoint || options.aiEndpoint === prevConfig.endpoint;
    const shouldResetModel = !options.aiModel || options.aiModel === prevConfig.model;

    updateOption({
      aiProvider: nextProvider,
      ...(shouldResetEndpoint ? { aiEndpoint: nextConfig.endpoint } : {}),
      ...(shouldResetModel ? { aiModel: nextConfig.model } : {}),
    });
  };

  const runAssistant = async () => {
    if (!hasKey) {
      setError('Add your API key first in the BYOK section.');
      return;
    }

    const text = prompt.trim();
    if (!text) return;

    setLoading(true);
    setError('');

    try {
      const parsedEndpoint = new URL(endpoint);
      if (parsedEndpoint.protocol !== 'https:') {
        throw new Error('Endpoint must use HTTPS.');
      }
      if (!allowedHostsByProvider[provider]?.has(parsedEndpoint.host)) {
        throw new Error(`Endpoint host is not allowed for ${provider}.`);
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.aiApiKey.trim()}`,
      };

      if (provider === 'openrouter') {
        if (typeof window !== 'undefined' && window.location?.origin) {
          headers['HTTP-Referer'] = window.location.origin;
        }
        headers['X-Title'] = 'dogeub';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an assistant inside an internet hub. Give concise, safe browsing help and actionable steps.',
            },
            { role: 'user', content: text },
          ],
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const bodyText = await res.text();
        let userMessage = `Request failed (${res.status})`;

        try {
          const data = JSON.parse(bodyText);
          const safeMessage =
            data && typeof data === 'object'
              ? data.error?.message ?? data.message ?? data.error
              : null;

          if (typeof safeMessage === 'string' && safeMessage.trim()) {
            userMessage = safeMessage;
          }
        } catch {
          // fall through to generic message
        }

        console.error('AIAssistant request failed', { status: res.status, body: bodyText });
        throw new Error(userMessage);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || 'No response content returned.';
      setResponse(content);
    } catch (err) {
      if (err?.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err?.message || 'Failed to run assistant.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={panelClass}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} />
        <h3 className="font-semibold text-lg">AI Assistant (BYOK)</h3>
      </div>
      <p className="text-sm opacity-80 mb-4">
        Supports OpenAI, OpenRouter, and Gemini keys. Your key stays in local storage on this device.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="rounded-lg bg-black/20 border border-white/10 px-3 py-2 outline-none"
        >
          {Object.entries(providerConfig).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
        <input
          type="password"
          placeholder={`API key (${defaults.keyPlaceholder})`}
          value={options.aiApiKey || ''}
          onChange={(e) => updateOption({ aiApiKey: e.target.value })}
          onBlur={(e) => updateOption({ aiApiKey: e.target.value })}
          className="rounded-lg bg-black/20 border border-white/10 px-3 py-2 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          placeholder="Model"
          value={model}
          onChange={(e) => updateOption({ aiModel: e.target.value })}
          className="rounded-lg bg-black/20 border border-white/10 px-3 py-2 outline-none"
        />
        <input
          type="text"
          placeholder="Endpoint (OpenAI-compatible)"
          value={endpoint}
          onChange={(e) => updateOption({ aiEndpoint: e.target.value })}
          className="rounded-lg bg-black/20 border border-white/10 px-3 py-2 outline-none"
        />
      </div>

      <div className="flex gap-2">
        <textarea
          rows={3}
          placeholder="Ask for help (example: plan my research on climate change)."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 rounded-lg bg-black/20 border border-white/10 px-3 py-2 outline-none resize-y"
        />
        <button
          onClick={runAssistant}
          disabled={loading}
          className="rounded-lg px-4 py-2 h-fit flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          {hasKey ? <Send size={16} /> : <KeyRound size={16} />}
          {loading ? 'Running...' : 'Ask'}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      {response && (
        <pre className="text-sm whitespace-pre-wrap mt-3 p-3 rounded-lg bg-black/20 border border-white/10 max-h-80 overflow-auto">{response}</pre>
      )}
    </section>
  );
};

export default AIAssistant;
