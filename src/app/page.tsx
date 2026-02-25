'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Room {
  id: string
  name: string
  createdAt: string
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [newRoom, setNewRoom] = useState('')

  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(setRooms)
  }, [])

  async function createRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoom.trim()) return
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoom.trim() }),
    })
    const room = await res.json()
    setRooms(prev => [room, ...prev])
    setNewRoom('')
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Chat Rooms</h1>
      <form onSubmit={createRoom} className="flex gap-2 mb-8">
        <input
          value={newRoom}
          onChange={e => setNewRoom(e.target.value)}
          placeholder="New room name..."
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium">
          Create
        </button>
      </form>
      <div className="space-y-2">
        {rooms.map(room => (
          <Link key={room.id} href={`/room/${room.id}`}
            className="block bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 transition">
            <span className="font-medium">{room.name}</span>
          </Link>
        ))}
        {rooms.length === 0 && <p className="text-gray-400">No rooms yet. Create one above!</p>}
      </div>
    </div>
  )
}
