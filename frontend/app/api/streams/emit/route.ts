import { NextRequest, NextResponse } from 'next/server'
import { emitAuctionEvent } from '@/lib/streams-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, data } = body

    if (!eventId || !data) {
      return NextResponse.json(
        { error: 'Missing eventId or data in request body' },
        { status: 400 }
      )
    }

    const result = await emitAuctionEvent(eventId, data)
    
    return NextResponse.json({ 
      success: true, 
      txHash: result 
    })
  } catch (error) {
    console.error('Error emitting event:', error)
    return NextResponse.json(
      { error: 'Failed to emit event' },
      { status: 500 }
    )
  }
}