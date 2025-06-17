import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Create a Supabase client with the service role key (bypasses RLS)
const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function POST(request: Request) {
  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      console.error("Failed to parse request body:", e)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { score, name } = body

    // Validate score
    if (score === undefined || typeof score !== "number") {
      return NextResponse.json({ error: "Invalid score: must be a number" }, { status: 400 })
    }

    // Generate player name if not provided
    const playerName = name || `Player_${Math.floor(Math.random() * 10000)}`

    // Insert the score using the service role key
    const { error } = await supabase.from("scores").insert({
      score: score,
      name: playerName,
    })

    if (error) {
      console.error("Supabase error saving score:", error)
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Unhandled error in scores API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
