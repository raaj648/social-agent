'use client';

import { useState } from 'react';
import { usePageTitle } from '@/lib/use-page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Send, Loader2, RefreshCw } from 'lucide-react';

export default function PlaygroundPage() {
  usePageTitle('AI Playground');
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleTest() {
    if (!input.trim()) return;
    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('/api/ai/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: input }),
      });
      const data = await res.json();
      if (data.error) {
        setResponse(`Error: ${data.error}`);
      } else {
        setResponse(data.reply || 'No response generated');
      }
    } catch (e: any) {
      setResponse(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">AI Playground</h1>
        <p className="text-muted-foreground">Test how your AI responds to customer messages</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5 text-blue-600" />
                Simulate Customer Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a customer message here...&#10;&#10;Example: Hi, how much does your product cost?&#10;Example: I want to place an order&#10;Example: What are your business hours?"
                rows={5}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
              <div className="flex items-center gap-3">
                <Button onClick={handleTest} disabled={loading || !input.trim()} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {loading ? 'Processing...' : 'Test Response'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5 text-purple-600" />
                AI Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">AI is thinking...</p>
                </div>
              ) : response ? (
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border border-purple-200 dark:border-purple-800 p-4">
                  <p className="text-sm whitespace-pre-wrap">{response}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bot className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Enter a message and click Test Response</p>
                  <p className="text-xs text-muted-foreground mt-1">Response will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-5 w-5 text-amber-600" />
            Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-blue-600 font-bold">•</span> The AI uses YOUR knowledge base, master prompt, and AI settings to generate responses.</li>
            <li className="flex gap-2"><span className="text-blue-600 font-bold">•</span> Try asking about pricing, delivery, or products you have in your knowledge base.</li>
            <li className="flex gap-2"><span className="text-blue-600 font-bold">•</span> If you have order collection enabled, try placing an order to test the flow.</li>
            <li className="flex gap-2"><span className="text-blue-600 font-bold">•</span> Playground usage consumes your credits, just like real conversations.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
