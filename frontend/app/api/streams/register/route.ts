import { NextRequest, NextResponse } from 'next/server'
import { registerSchemas } from '@/lib/streams-server'

export async function POST(request: NextRequest) {
  try {
    const result = await registerSchemas()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Schemas registered successfully',
      result 
    })
  } catch (error) {
    console.error('Error registering schemas:', error)
    return NextResponse.json(
      { error: 'Failed to register schemas' },
      { status: 500 }
    )
  }
}