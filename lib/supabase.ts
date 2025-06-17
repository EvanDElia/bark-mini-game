import { createClient } from "@supabase/supabase-js"

// Define the types for our database based on the actual schema
export type SupabaseScore = {
  id?: number
  name: string
  score: number
  created_at?: string
}

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a singleton instance of the Supabase client
let supabaseInstance: ReturnType<typeof createClient> | null = null

export const getSupabaseClient = () => {
  if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

// Function to save a score to Supabase via our API endpoint
export async function saveScore(score: number, playerName?: string): Promise<boolean> {
  try {
    // Get or create a player name from localStorage
    let name = localStorage.getItem("barkGamePlayerName") || playerName
    if (!name) {
      // Generate a random player name if none exists
      name = `Player_${Math.floor(Math.random() * 10000)}`
      localStorage.setItem("barkGamePlayerName", name)
    }

    // Use our API endpoint to save the score
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        score,
        name,
      }),
    })

    // Handle non-OK responses
    if (!response.ok) {
      let errorMessage = "Failed to save score"

      try {
        // Try to parse error response as JSON
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch (parseError) {
        // If JSON parsing fails, use status text
        errorMessage = `${response.status}: ${response.statusText}`
      }

      console.error("Error saving score:", errorMessage)
      return false
    }

    // Parse successful response
    try {
      const data = await response.json()
      return data.success === true
    } catch (parseError) {
      console.error("Error parsing success response:", parseError)
      return false
    }
  } catch (error) {
    console.error("Error saving score:", error)
    return false
  }
}

// Function to fetch global high scores from Supabase
export async function fetchGlobalScores(
  page = 0,
  limit = 10,
): Promise<{
  data: SupabaseScore[] | null
  count: number | null
  error: any
}> {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      console.error("Supabase client not initialized")
      return { data: null, count: null, error: "Supabase client not initialized" }
    }

    // Calculate offset based on page and limit
    const offset = page * limit

    // Fetch scores with pagination
    const { data, error, count } = await supabase
      .from("scores")
      .select("*", { count: "exact" })
      .order("score", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Error fetching global scores:", error)
      return { data: null, count: null, error }
    }

    return { data, count, error: null }
  } catch (error) {
    console.error("Error fetching global scores:", error)
    return { data: null, count: null, error }
  }
}

// Function to fetch a player's scores
export async function fetchPlayerScores(limit = 10): Promise<SupabaseScore[] | null> {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      console.error("Supabase client not initialized")
      return null
    }

    // Get player name from localStorage
    const playerName = localStorage.getItem("barkGamePlayerName")
    if (!playerName) {
      return []
    }

    // Fetch player's scores
    const { data, error } = await supabase
      .from("scores")
      .select("*")
      .eq("name", playerName)
      .order("score", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error fetching player scores:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error fetching player scores:", error)
    return null
  }
}
