'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Message {
  id: string
  content: string
  sender: string
  createdAt: string
}

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sender, setSender] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('chat-username')
    if (saved) setSender(saved)
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/messages?roomId=${id}`).then(r => r.json()).then(setMessages)
    const interval = setInterval(() => {
      fetch(`/api/messages?roomId=${id}`).then(r => r.json()).then(setMessages)
    }, 2000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !sender.trim()) return
    localStorage.setItem('chat-username', sender)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input.trim(), sender: sender.trim(), roomId: id }),
    })
    const msg = await res.json()
    setMessages(prev => [...prev, msg])
    setInput('')
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      <header className="flex items-center gap-4 p-4 border-b border-gray-800">
        <Link href="/" className="text-gray-400 hover:text-white">&larr; Back</Link>
        <h1 className="text-xl font-bold">Chat Room</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className="bg-gray-800 rounded-lg px-4 py-2">
            <span className="text-blue-400 font-medium text-sm">{msg.sender}</span>
            <p className="mt-1">{msg.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="p-4 border-t border-gray-800 flex gap-2">
        <input
          value={sender}
          onChange={e => setSender(e.target.value)}
          placeholder="Your name"
          className="w-32 bg-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium">
          Send
        </button>
      </form>
    </div>
  )
}
