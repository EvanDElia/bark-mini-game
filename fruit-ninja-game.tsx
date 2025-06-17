"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Folder } from "./components/folder"
import { FolderGenerator } from "./utils/folder-generator"
import { saveScore, fetchGlobalScores, type SupabaseScore } from "./lib/supabase"

interface Block {
  id: string
  x: number
  y: number
  color: string
  size: number
  isSliced: boolean
  justSpawned: boolean
  isAnimatingOut: boolean
  spawnTime: number
  title: string
  description: string
  iconType: "star" | "people" | "skull"
  points: number
}

interface MousePosition {
  x: number
  y: number
}

interface HighScore {
  score: number
  date: string
  timestamp: number
}

interface FolderData {
  id: string
  title: string
  x: number
  y: number
}

type GameState = "waiting" | "playing" | "paused" | "gameover"

export default function FruitNinjaGame() {
  const [gameState, setGameState] = useState<GameState>("waiting")
  const [blocks, setBlocks] = useState<Block[]>([])
  const [score, setScore] = useState(0)
  const [prevScore, setPrevScore] = useState(0)
  const [scoreAnimation, setScoreAnimation] = useState<"increase" | "decrease" | null>(null)
  const [timeLeft, setTimeLeft] = useState(60) // 60 seconds timer
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 })
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [trail, setTrail] = useState<MousePosition[]>([])
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const redBlockTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [highScores, setHighScores] = useState<HighScore[]>([])
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [showScoresModal, setShowScoresModal] = useState(false)
  const [activeScoreTab, setActiveScoreTab] = useState<"user" | "global">("user")
  const [folders, setFolders] = useState<FolderData[]>([])
  const folderGeneratorRef = useRef<FolderGenerator | null>(null)
  const spawnRateMultiplierRef = useRef<number>(1) // Track spawn rate multiplier: 1 = normal, 2 = twice as fast, 3 = three times as fast
  const baseSpawnIntervalRef = useRef<number>(1500 + Math.random() * 400) // Base spawn interval in ms (1000ms + 500ms random)
  const [showIntroModal, setShowIntroModal] = useState(false)
  const [playerName, setPlayerName] = useState<string>("")
  const [globalScores, setGlobalScores] = useState<SupabaseScore[]>([])
  const [globalScoresPage, setGlobalScoresPage] = useState(0)
  const [globalScoresTotal, setGlobalScoresTotal] = useState(0)
  const [isLoadingGlobalScores, setIsLoadingGlobalScores] = useState(false)
  const [showNameInputModal, setShowNameInputModal] = useState(false)
  const [tempPlayerName, setTempPlayerName] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // Block titles and descriptions for each type
  const regularTitles = ["Email", "Message", "Update", "Reminder", "Event", "Meeting", "Task", "Project"]
  const regularDescriptions = [
    "New message",
    "Important update",
    "Needs review",
    "In progress",
    "Completed",
    "Pending",
    "High priority",
    "Due today",
  ]

  const bonusTitles = ["Bonus", "Achievement", "Reward", "Prize", "Gift", "Special", "Premium", "VIP"]
  const bonusDescriptions = [
    "Extra points!",
    "Bonus reward",
    "Special offer",
    "Premium content",
    "Achievement unlocked",
    "Rare find",
    "Lucky bonus",
    "Super reward",
  ]

  const spamTitles = ["Spam", "Virus", "Malware", "Phishing", "Scam", "Threat", "Warning", "Alert"]
  const spamDescriptions = [
    "Malicious content",
    "Security threat",
    "Virus detected",
    "Phishing attempt",
    "Spam message",
    "Dangerous link",
    "Malware alert",
    "Scam warning",
  ]

  // Only 3 colors now: Blue, Yellow, Red
  const colors = {
    blue: "#45b7d1", // Regular notifications - people icon - +10 points
    yellow: "#feca57", // Bonus notifications - star icon - +25 points
    red: "#ff6b6b", // Spam notifications - skull icon - -25 points
  }

  // Initialize folder generator
  useEffect(() => {
    folderGeneratorRef.current = new FolderGenerator(15)

    // Generate some initial folders
    if (folderGeneratorRef.current) {
      const initialFolders = folderGeneratorRef.current.generateRandomFolders(8)
      setFolders(initialFolders)
    }

    // Load player name from localStorage
    const savedPlayerName = localStorage.getItem("barkGamePlayerName")
    if (savedPlayerName) {
      setPlayerName(savedPlayerName)
    }
  }, [])

  // Load high scores from localStorage on component mount
  useEffect(() => {
    const savedScores = localStorage.getItem("fruitNinjaHighScores")
    if (savedScores) {
      try {
        const scores = JSON.parse(savedScores)
        setHighScores(scores)
      } catch (error) {
        console.error("Error loading high scores:", error)
        setHighScores([])
      }
    }
  }, [])

  // Load global scores when tab is active
  useEffect(() => {
    if (activeScoreTab === "global" && showScoresModal) {
      loadGlobalScores()
    }
  }, [activeScoreTab, showScoresModal, globalScoresPage])

  // Detect mobile and touch devices
  useEffect(() => {
    const checkDeviceType = () => {
      // Check for mobile device
      const mobileCheck =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768
      setIsMobile(mobileCheck)

      // Check for touch device
      const touchCheck = "ontouchstart" in window || navigator.maxTouchPoints > 0
      setIsTouchDevice(touchCheck)
    }

    checkDeviceType()

    // Re-check on window resize
    window.addEventListener("resize", checkDeviceType)
    return () => window.removeEventListener("resize", checkDeviceType)
  }, [])

  // Load global scores
  const loadGlobalScores = async () => {
    setIsLoadingGlobalScores(true)
    try {
      const { data, count, error } = await fetchGlobalScores(globalScoresPage, 10)
      console.log(data, count, error)
      if (data && !error) {
        setGlobalScores(data)
        if (count !== null) {
          setGlobalScoresTotal(count)
        }
      }
    } catch (error) {
      console.error("Error loading global scores:", error)
    } finally {
      setIsLoadingGlobalScores(false)
    }
  }

  // Handle player name submission
  const handlePlayerNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tempPlayerName.trim()) {
      setPlayerName(tempPlayerName.trim())
      localStorage.setItem("barkGamePlayerName", tempPlayerName.trim())
      setShowNameInputModal(false)

      // If we're at game over, save the score now
      if (gameState === "gameover") {
        saveScore(score, tempPlayerName.trim())
      }
    }
  }

  // Detect score changes and trigger animations
  useEffect(() => {
    if (score > prevScore) {
      setScoreAnimation("increase")
    } else if (score < prevScore) {
      setScoreAnimation("decrease")
    }

    // Reset animation after it plays
    if (scoreAnimation) {
      const timer = setTimeout(() => {
        setScoreAnimation(null)
      }, 500) // Animation duration

      return () => clearTimeout(timer)
    }

    setPrevScore(score)
  }, [score, prevScore, scoreAnimation])

  // Save high scores to localStorage
  const saveHighScores = useCallback((scores: HighScore[]) => {
    try {
      localStorage.setItem("fruitNinjaHighScores", JSON.stringify(scores))
      setHighScores(scores)
    } catch (error) {
      console.error("Error saving high scores:", error)
    }
  }, [])

  // Add new high score
  const addHighScore = useCallback(
    (newScore: number) => {
      const newHighScore: HighScore = {
        score: newScore,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
      }

      const updatedScores = [...highScores, newHighScore]
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .slice(0, 10) // Keep only top 10

      // Check if this is a new high score (top 3)
      const isNewHigh = updatedScores.findIndex((score) => score.timestamp === newHighScore.timestamp) < 3
      setIsNewHighScore(isNewHigh)

      saveHighScores(updatedScores)

      // Save score to Supabase if player has a name
      if (playerName) {
        saveScore(newScore, playerName)
      } else {
        // Show name input modal if no player name
        setShowNameInputModal(true)
      }
    },
    [highScores, saveHighScores, playerName],
  )

  // Get current high score
  const getCurrentHighScore = useCallback(() => {
    return highScores.length > 0 ? highScores[0].score : 0
  }, [highScores])

  // Fullscreen handler
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error)
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Format date from ISO string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  // Generate random block
  const generateBlock = useCallback((): Block => {
    // Use window dimensions as fallback
    const width = window.innerWidth
    const height = window.innerHeight

    // Determine block type with weighted probabilities
    const rand = Math.random()
    let blockType: "regular" | "bonus" | "spam"
    let color: string
    let iconType: "star" | "people" | "skull"
    let points: number
    let title: string
    let description: string

    if (rand < 0.15) {
      // 15% chance for bonus (yellow)
      blockType = "bonus"
      color = colors.yellow
      iconType = "star"
      points = 25
      title = bonusTitles[Math.floor(Math.random() * bonusTitles.length)]
      description = bonusDescriptions[Math.floor(Math.random() * bonusDescriptions.length)]
    } else if (rand < 0.35) {
      // 20% chance for spam (red)
      blockType = "spam"
      color = colors.red
      iconType = "skull"
      points = -25
      title = spamTitles[Math.floor(Math.random() * spamTitles.length)]
      description = spamDescriptions[Math.floor(Math.random() * spamDescriptions.length)]
    } else {
      // 65% chance for regular (blue)
      blockType = "regular"
      color = colors.blue
      iconType = "people"
      points = 10
      title = regularTitles[Math.floor(Math.random() * regularTitles.length)]
      description = regularDescriptions[Math.floor(Math.random() * regularDescriptions.length)]
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (width - 300) + 20, // Add some padding
      y: Math.random() * (height - 300) + 100, // Increased bottom padding to avoid footer
      color: color,
      size: 100, // Increased size to accommodate text
      isSliced: false,
      justSpawned: true,
      isAnimatingOut: false,
      spawnTime: Date.now(), // Track when the block was created
      title: title,
      description: description,
      iconType: iconType,
      points: points,
    }
  }, [])

  // Manual spawn for testing
  const spawnTestBlock = useCallback(() => {
    const newBlock = generateBlock()
    console.log("Spawning test block:", newBlock)
    setBlocks((prev) => [...prev, newBlock])
  }, [generateBlock])

  // Update spawn rate based on time left - Updated intervals
  const updateSpawnRate = useCallback(
    (secondsLeft: number) => {
      let newMultiplier = 1

      if (secondsLeft <= 15) {
        newMultiplier = 4 // Three times as fast when 30 seconds or less remain
      } else if (secondsLeft <= 30) {
        newMultiplier = 3 // Three times as fast when 30 seconds or less remain
      } else if (secondsLeft <= 45) {
        newMultiplier = 2 // Twice as fast when 45 seconds or less remain
      }

      // Only update if the multiplier has changed
      if (newMultiplier !== spawnRateMultiplierRef.current) {
        spawnRateMultiplierRef.current = newMultiplier

        // restart the spawn interval with the new rate
        if (spawnIntervalRef.current) {
          clearInterval(spawnIntervalRef.current)

          // Calculate new spawn interval based on multiplier
          const newInterval = baseSpawnIntervalRef.current / newMultiplier
          console.log(newInterval)

          spawnIntervalRef.current = setInterval(() => {
            setBlocks((prev) => {
              const filtered = prev.filter((block) => !block.isSliced && !block.isAnimatingOut)
              if (filtered.length < 10) {
                const newBlock = generateBlock()
                return [...filtered, newBlock]
              }
              return filtered
            })
          }, newInterval)

          console.log(`Spawn rate updated: ${newMultiplier}x faster (every ${newInterval}ms)`)
        }
      }
    },
    [generateBlock, setBlocks],
  )

  // Show intro modal and pause game
  const showIntroAndPause = useCallback(() => {
    if (gameState === "playing") {
      setGameState("paused")
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      setShowIntroModal(true)
    }
  }, [gameState])

  // Close intro modal and resume game
  const closeIntroAndResume = useCallback(() => {
    setShowIntroModal(false)
    if (gameState === "paused") {
      setGameState("playing")
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          const newTime = prevTime - 1

          // Update spawn rate based on time left
          updateSpawnRate(newTime)

          if (newTime <= 0) {
            // Game over when timer reaches 0
            endGame()
            return 0
          }
          return newTime
        })
      }, 1000)
    }
  }, [gameState])

  // Check for expired red blocks every second
  useEffect(() => {
    if (gameState === "playing") {
      const checkExpiredBlocks = () => {
        const currentTime = Date.now()
        setBlocks((prev) =>
          prev.map((block) => {
            // If it's a red block and it's been 8 seconds since spawn, mark it for removal
            if (
              block.color === colors.red &&
              !block.isSliced &&
              !block.isAnimatingOut &&
              currentTime - block.spawnTime >= 8000
            ) {
              return { ...block, isAnimatingOut: true }
            }
            return block
          }),
        )
      }

      redBlockTimeoutRef.current = setInterval(checkExpiredBlocks, 100) // Check every 100ms for smooth removal

      return () => {
        if (redBlockTimeoutRef.current) {
          clearInterval(redBlockTimeoutRef.current)
          redBlockTimeoutRef.current = null
        }
      }
    }
  }, [gameState])

  // Add a new folder
  const addFolder = useCallback(() => {
    if (folderGeneratorRef.current) {
      const newFolder = folderGeneratorRef.current.generateFolder(`Folder ${Math.floor(Math.random() * 100)}`)
      setFolders((prev) => [...prev, newFolder])
    }
  }, [])

  // Start the game
  const startGame = useCallback(() => {
    console.log("Starting game...")
    setGameState("playing")
    setScore(0)
    setTimeLeft(60) // Reset timer to 60 seconds
    setBlocks([])
    setTrail([])
    setIsNewHighScore(false)
    setShowScoresModal(false) // Close scores modal when starting new game
    spawnRateMultiplierRef.current = 1 // Reset spawn rate multiplier

    // Generate some new folders when game starts
    if (folderGeneratorRef.current) {
      folderGeneratorRef.current.clearFolders()
      const gameFolders = folderGeneratorRef.current.generateRandomFolders(5)
      setFolders(gameFolders)
    }

    // Spawn first block immediately
    const firstBlock = generateBlock()
    console.log("First block:", firstBlock)
    setBlocks([firstBlock])

    // Start block spawning with initial rate
    const initialSpawnInterval = baseSpawnIntervalRef.current
    spawnIntervalRef.current = setInterval(() => {
      setBlocks((prev) => {
        const filtered = prev.filter((block) => !block.isSliced && !block.isAnimatingOut)
        if (filtered.length < 10) {
          const newBlock = generateBlock()
          return [...filtered, newBlock]
        }
        return filtered
      })
    }, initialSpawnInterval)

    // Start timer countdown
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        const newTime = prevTime - 1

        // Update spawn rate based on time left
        updateSpawnRate(newTime)

        if (newTime <= 0) {
          // Game over when timer reaches 0
          endGame()
          return 0
        }
        return newTime
      })
    }, 1000)
  }, [generateBlock, updateSpawnRate, gameState])

  // End the game
  const endGame = useCallback(() => {
    console.log("Game over!")
    setGameState("gameover")
    setBlocks([])

    // Add score to high scores
    if (score > 0) {
      addHighScore(score)
    }

    // Clear all intervals
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current)
      spawnIntervalRef.current = null
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    if (redBlockTimeoutRef.current) {
      clearInterval(redBlockTimeoutRef.current)
      redBlockTimeoutRef.current = null
    }
  }, [score, addHighScore])

  // Stop the game
  const stopGame = useCallback(() => {
    console.log("Stopping game...")
    setGameState("waiting")
    setBlocks([])
    setTrail([])

    // Clear all intervals
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current)
      spawnIntervalRef.current = null
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    if (redBlockTimeoutRef.current) {
      clearInterval(redBlockTimeoutRef.current)
      redBlockTimeoutRef.current = null
    }
  }, [])

  // Track mouse position
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (gameState !== "playing") return

      const gameArea = gameAreaRef.current
      if (!gameArea) return

      const rect = gameArea.getBoundingClientRect()
      const newPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }

      setMousePosition(newPosition)

      if (isMouseDown) {
        setTrail((prev) => {
          const newTrail = [...prev, newPosition]
          return newTrail.slice(-8)
        })
      }
    },
    [isMouseDown, gameState],
  )

  // Check collision between mouse and blocks
  const checkCollision = useCallback((mousePos: MousePosition, block: Block) => {
    const blockCenterX = block.x + block.size // Center X for double-width block
    const blockCenterY = block.y + block.size / 2 // Center Y

    // Calculate distances in both x and y directions independently
    const deltaX = Math.abs(mousePos.x - blockCenterX)
    const deltaY = Math.abs(mousePos.y - blockCenterY)

    // Check if mouse is within the rectangular bounds
    // Width is double the size (block.size * 2), so half-width is block.size
    // Height is block.size, so half-height is block.size / 2
    return deltaX <= block.size && deltaY <= block.size / 2
  }, [])

  // Handle mouse down
  const handleMouseDown = useCallback(() => {
    if (gameState !== "playing") return
    setIsMouseDown(true)
    setTrail([mousePosition])
  }, [mousePosition, gameState])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false)
    setTrail([])
  }, [])

  // Check for end game
  useEffect(() => {
    if (gameState == "gameover") endGame()
  }, [gameState])

  // Check for slicing when mouse moves
  useEffect(() => {
    if (isMouseDown && gameState === "playing") {
      setBlocks((prev) =>
        prev.map((block) => {
          if (!block.isSliced && !block.isAnimatingOut && checkCollision(mousePosition, block)) {
            // Use the block's points value
            setScore((s) => s + block.points)
            return { ...block, isSliced: true, isAnimatingOut: true }
          }
          return block
        }),
      )
    }
  }, [mousePosition, isMouseDown, checkCollision, gameState])

  // Remove sliced blocks after animation
  useEffect(() => {
    const timeout = setTimeout(() => {
      setBlocks((prev) => prev.filter((block) => !block.isAnimatingOut))
    }, 800)

    return () => clearTimeout(timeout)
  }, [blocks])

  // Remove justSpawned flag after spawn animation
  useEffect(() => {
    const timeout = setTimeout(() => {
      setBlocks((prev) =>
        prev.map((block) => {
          if (block.justSpawned) {
            return { ...block, justSpawned: false }
          }
          return block
        }),
      )
    }, 500)

    return () => clearTimeout(timeout)
  }, [blocks])

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (redBlockTimeoutRef.current) clearInterval(redBlockTimeoutRef.current)
    }
  }, [])

  // Get difficulty level text based on spawn rate multiplier
  const getDifficultyText = useCallback(() => {
    switch (spawnRateMultiplierRef.current) {
      case 1:
        return "Normal"
      case 2:
        return "Fast"
      case 3:
        return "Extreme"
      case 4:
        return "Insane"
      default:
        return "Normal"
    }
  }, [])

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{
        backgroundImage: "url(/background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/20 z-0"></div>

      <style jsx>{`
        @keyframes spawn-in {
          0% {
            transform: scale(0) translateY(190px);
            opacity: 0;
          }
          50% {
            transform: scale(1.07) translateY(0px);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
        }
        @keyframes celebration {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-5deg); }
          75% { transform: scale(1.1) rotate(5deg); }
        }
        @keyframes score-increase {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); color: #4ade80; }
          100% { transform: scale(1); }
        }

        @keyframes score-decrease {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); color: #f87171; }
          100% { transform: scale(1); }
        }
        
        .score-increase {
          animation: score-increase 0.5s ease-in-out;
        }

        .score-decrease {
          animation: score-decrease 0.5s ease-in-out;
        }

        /* System UI Modal Styles */
        .system-modal {
          background: linear-gradient(to bottom, #1a365d50, #2a4365ff);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          border-radius: 8px;
          overflow: hidden;
          backdrop-filter: blur(3px);
          padding: 8px;
          max-height: 88vh;
          overflow-y:auto;
          margin-bottom: 70px;
        }

        .system-modal-content {
          background-color: #f0f4f8f0;
          border-radius: 0 0 8px 8px;
          color: #1a202c;
        }

        .system-modal-header {
          padding: 10px 15px;
          position: relative;
        }

        .system-modal-title {
          color: white;
          font-weight: bold;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .system-close-button {
          position: absolute;
          top: 0;
          right: 0;
          background: linear-gradient(to bottom, #e53e3e, #c53030);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-weight: bold;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          margin: 10px;
        }

        .system-close-button:hover {
          background: linear-gradient(to bottom, #f56565, #e53e3e);
        }

        .system-button {
          background: linear-gradient(to bottom, #3182ce, #2b6cb0);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          font-weight: bold;
          padding: 8px 16px;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.2);
          transition: all 0.2s;
          position: relative;
        }

        .system-button:hover {
          background: linear-gradient(to bottom, #4299e1, #3182ce);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.3),
                      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);
        }

        .system-button:active {
          background: linear-gradient(to bottom, #2b6cb0, #2c5282);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3),
                      inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transform: translateY(1px);
        }

        .system-button-green {
          background: linear-gradient(to bottom, #38a169, #2f855a);
        }

        .system-button-green:hover {
          background: linear-gradient(to bottom, #48bb78, #38a169);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.3),
                      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        }

        .system-button-green:active {
          background: linear-gradient(to bottom, #2f855a, #276749);
        }

        .system-button-red {
          background: linear-gradient(to bottom, #e53e3e, #c53030);
        }

        .system-button-red:hover {
          background: linear-gradient(to bottom, #f56565, #e53e3e);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.3),
                      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        }
        
        .system-input {
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          padding: 8px 12px;
          width: 100%;
          font-size: 16px;
          transition: all 0.2s;
        }
        
        .system-input:focus {
          outline: none;
          border-color: #3182ce;
          box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.3);
        }
      `}</style>

      {/* Game Controls */}
      <div className="absolute z-50 top-4 right-4 flex gap-2 flex-col">
        {gameState === "playing" && (
          <>
            <button onClick={stopGame} className="z-50 system-button system-button-red">
              Stop Game
            </button>
            <button onClick={spawnTestBlock} className="z-50 system-button">
              Spawn Block
            </button>
            <button onClick={addFolder} className="z-50 system-button system-button-green">
              Add Folder
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      {gameState === "waiting" && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="system-modal max-w-2xl w-full">
            <div className="system-modal-header">
              <h1 className="system-modal-title text-2xl">Welcome</h1>
            </div>
            <div className="system-modal-content p-8 text-center">
              <h1 className="text-slate-800 text-4xl font-bold mb-4">BARK Mini-Game</h1>
              <p className="text-slate-700 text-lg mb-4">
                {isTouchDevice ? "Tap and drag your finger" : "Click and drag your mouse"} over the colored blocks to
                close them and earn points!
              </p>
              <p className="text-slate-700 text-lg mb-4">You have 60 seconds to score as many points as possible!</p>

              <div className="flex flex-col gap-3 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-left">
                  <h3 className="text-slate-800 font-bold mb-2 text-lg">Notification Types:</h3>
                  <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#45b7d1] rounded-full mr-2 align-middle"></span>
                      <span className="text-blue-600 font-bold">Blue notifications: +10 points</span> (regular messages)
                    </li>
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#feca57] rounded-full mr-2 align-middle"></span>
                      <span className="text-yellow-600 font-bold">Yellow notifications: +25 points</span> (bonus
                      rewards!)
                    </li>
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#ff6b6b] rounded-full mr-2 align-middle"></span>
                      <span className="text-red-600 font-bold">Red notifications: -25 points</span> (spam - avoid
                      these!)
                    </li>
                    <li>
                      <span className="text-amber-600 font-bold">Red notifications disappear after 8 seconds</span>
                    </li>
                    <li>
                      <span className="text-blue-600 font-bold">Speed increases at 45s, 30s, and 15s remaining!</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* High Score Display */}
              {getCurrentHighScore() > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
                  <p className="text-amber-700 text-sm mb-1">Current High Score</p>
                  <p className="text-slate-800 text-3xl font-bold">{getCurrentHighScore()}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={startGame} className="system-button system-button-green text-xl px-8 py-3 flex-1">
                  Start Playing
                </button>
                <button onClick={() => setShowScoresModal(true)} className="system-button text-xl px-8 py-3 flex-1">
                  View Scores
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Name Input Modal */}
      {showNameInputModal && (
        <div className="absolute inset-0 flex items-center justify-center z-[60] bg-black/50">
          <div className="system-modal max-w-md w-full">
            <div className="system-modal-header">
              <h1 className="system-modal-title text-2xl">Enter Your Name</h1>
            </div>
            <div className="system-modal-content p-6">
              <form onSubmit={handlePlayerNameSubmit}>
                <p className="text-slate-700 mb-4">Enter your name to save your score to the global leaderboard!</p>
                <div className="mb-4">
                  <input
                    type="text"
                    className="system-input"
                    placeholder="Your name"
                    value={tempPlayerName}
                    onChange={(e) => setTempPlayerName(e.target.value)}
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="system-button system-button-green flex-1">
                    Save Score
                  </button>
                  <button type="button" onClick={() => setShowNameInputModal(false)} className="system-button flex-1">
                    Skip
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Intro Modal - Can be shown during gameplay */}
      {showIntroModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="system-modal max-w-2xl w-full">
            <div className="system-modal-header">
              <h1 className="system-modal-title text-2xl">Instructions</h1>
              <button onClick={closeIntroAndResume} className="system-close-button">
                ✕
              </button>
            </div>
            <div className="system-modal-content p-8 text-center">
              <h1 className="text-slate-800 text-4xl font-bold mb-4">Game Instructions</h1>
              <p className="text-slate-700 text-lg mb-4">
                {isTouchDevice ? "Tap and drag your finger" : "Click and drag your mouse"} over the colored blocks to
                close them and earn points!
              </p>
              <p className="text-slate-700 text-lg mb-4">You have 60 seconds to score as many points as possible!</p>

              <div className="flex flex-col gap-3 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-left">
                  <h3 className="text-slate-800 font-bold mb-2 text-lg">Notification Types:</h3>
                  <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#45b7d1] rounded-full mr-2 align-middle"></span>
                      <span className="text-blue-600 font-bold">Blue notifications: +10 points</span> (regular messages)
                    </li>
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#feca57] rounded-full mr-2 align-middle"></span>
                      <span className="text-yellow-600 font-bold">Yellow notifications: +25 points</span> (bonus
                      rewards!)
                    </li>
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#ff6b6b] rounded-full mr-2 align-middle"></span>
                      <span className="text-red-600 font-bold">Red notifications: -25 points</span> (spam - avoid
                      these!)
                    </li>
                    <li>
                      <span className="text-amber-600 font-bold">Red notifications disappear after 8 seconds</span>
                    </li>
                    <li>
                      <span className="text-blue-600 font-bold">Speed increases at 45s, 30s, and 15s remaining!</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button onClick={closeIntroAndResume} className="system-button text-xl px-8 py-3">
                {gameState === "paused" ? "Resume Game" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState === "gameover" && !showScoresModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="system-modal max-w-2xl w-full">
            <div className="system-modal-header">
              <h1 className="system-modal-title text-2xl">Game Over</h1>
            </div>
            <div className="system-modal-content p-8 text-center">
              <h1 className="text-slate-800 text-5xl font-bold mb-4">Game Over!</h1>

              {/* New High Score Celebration */}
              {isNewHighScore && (
                <div
                  className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200"
                  style={{ animation: "celebration 0.6s ease-in-out" }}
                >
                  <p className="text-amber-600 text-xl font-bold mb-2">🎉 NEW HIGH SCORE! 🎉</p>
                  <p className="text-slate-700 text-sm">You made it to the top 3!</p>
                </div>
              )}

              <div className="mb-8 mt-6">
                <div className="text-slate-800 text-7xl font-bold mb-2">{score}</div>
                <p className="text-slate-600 text-xl">Final Score</p>
              </div>

              {/* High Scores List */}
              {highScores.length > 0 && (
                <div className="mb-8 bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="text-slate-800 text-lg font-bold mb-3">High Scores</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {highScores.slice(0, 5).map((highScore, index) => (
                      <div key={highScore.timestamp} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">#{index + 1}</span>
                        <span className="text-slate-800 font-bold">{highScore.score}</span>
                        <span className="text-slate-500">{highScore.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={startGame} className="system-button system-button-green text-xl px-8 py-4 flex-1">
                  Play Again
                </button>
                <button onClick={() => setShowScoresModal(true)} className="system-button text-xl px-8 py-4 flex-1">
                  Scores
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scores Modal */}
      {showScoresModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="system-modal max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="system-modal-header">
              <h1 className="system-modal-title text-2xl">High Scores</h1>
              <button onClick={() => setShowScoresModal(false)} className="system-close-button">
                ✕
              </button>
            </div>
            <div className="system-modal-content p-8">
              {/* Tab Navigation */}
              <div className="flex mb-6 bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  onClick={() => setActiveScoreTab("user")}
                  className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all duration-200 ${
                    activeScoreTab === "user"
                      ? "system-button"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  User
                </button>
                <button
                  onClick={() => setActiveScoreTab("global")}
                  className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all duration-200 ${
                    activeScoreTab === "global"
                      ? "system-button"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  Global
                </button>
              </div>

              {/* Tab Content */}
              <div className="overflow-y-auto max-h-96">
                {activeScoreTab === "user" && (
                  <div>
                    {highScores.length > 0 ? (
                      <div className="space-y-3">
                        {highScores.map((highScore, index) => (
                          <div
                            key={highScore.timestamp}
                            className="bg-blue-50 rounded-xl p-4 border border-blue-200 flex justify-between items-center"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                #{index + 1}
                              </div>
                              <div>
                                <div className="text-slate-800 text-xl font-bold">{highScore.score}</div>
                                <div className="text-slate-500 text-sm">{highScore.date}</div>
                              </div>
                            </div>
                            {index === 0 && <div className="text-amber-500 text-2xl">👑</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-slate-500 text-xl mb-2">No scores yet!</div>
                        <div className="text-slate-400">Play a game to see your scores here.</div>
                      </div>
                    )}
                  </div>
                )}

                {activeScoreTab === "global" && (
                  <div>
                    {isLoadingGlobalScores ? (
                      <div className="text-center py-12">
                        <div className="text-slate-500 text-xl mb-2">Loading scores...</div>
                        <div className="animate-pulse mt-4 flex justify-center">
                          <div className="h-4 w-32 bg-slate-300 rounded"></div>
                        </div>
                      </div>
                    ) : globalScores.length > 0 ? (
                      <>
                        <div className="space-y-3 mb-6">
                          {globalScores.map((score, index) => (
                            <div
                              key={score.id}
                              className="bg-blue-50 rounded-xl p-4 border border-blue-200 flex justify-between items-center"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full flex items-center justify-center font-bold text-white text-sm">
                                  #{globalScoresPage * 10 + index + 1}
                                </div>
                                <div>
                                  <div className="text-slate-800 text-xl font-bold">{score.score}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 text-sm">{score.name}</span>
                                    <span className="text-slate-400 text-xs">•</span>
                                    <span className="text-slate-400 text-xs">
                                      {score.created_at ? formatDate(score.created_at) : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {globalScoresPage === 0 && index === 0 && (
                                <div className="text-amber-500 text-2xl">👑</div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {globalScoresTotal > 10 && (
                          <div className="flex justify-between items-center mt-4">
                            <button
                              onClick={() => setGlobalScoresPage(Math.max(0, globalScoresPage - 1))}
                              disabled={globalScoresPage === 0}
                              className={`system-button px-4 py-2 ${
                                globalScoresPage === 0 ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              Previous
                            </button>
                            <span className="text-slate-600">
                              Page {globalScoresPage + 1} of {Math.ceil(globalScoresTotal / 10)}
                            </span>
                            <button
                              onClick={() =>
                                setGlobalScoresPage(
                                  Math.min(Math.ceil(globalScoresTotal / 10) - 1, globalScoresPage + 1),
                                )
                              }
                              disabled={globalScoresPage >= Math.ceil(globalScoresTotal / 10) - 1}
                              className={`system-button px-4 py-2 ${
                                globalScoresPage >= Math.ceil(globalScoresTotal / 10) - 1
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-slate-500 text-xl mb-2">No global scores yet!</div>
                        <div className="text-slate-400">Be the first to set a high score!</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <button onClick={() => setShowScoresModal(false)} className="w-full system-button py-3 px-6">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className={`w-full h-full relative ${gameState === "playing" && !isTouchDevice ? "cursor-none" : "cursor-default"} pb-20 z-10 select-none`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Folders */}
        {folders.map((folder) => (
          <Folder key={folder.id} title={folder.title} x={folder.x} y={folder.y} />
        ))}

        {/* Blocks */}
        {blocks.map((block) => {
          // Determine animation class based on state priority
          let animationClass = "scale-100 opacity-100"
          let animationStyle = {}

          if (Date.now() - block.spawnTime >= 510 && block.justSpawned) {
            block.justSpawned = false
          }

          if (block.isAnimatingOut) {
            // Animation out takes priority
            animationClass = "scale-150 opacity-0 rotate-45 transition-all duration-500"
          } else if (block.justSpawned) {
            // Spawn animation
            animationClass = "scale-0 opacity-0"
            animationStyle = { animation: "spawn-in 0.4s ease-out forwards" }
          } else {
            // Normal state
            animationClass = "scale-100 opacity-80 hover:scale-105 transition-all duration-200"
          }

          // Determine which icon to use
          const iconSrc =
            block.iconType === "skull" ? "/skull.png" : block.iconType === "star" ? "/star.png" : "/people.png"

          return (
            <div
              key={block.id}
              className={`absolute rounded-xl shadow-2xl border-2 border-white/30 ${animationClass} overflow-hidden`}
              style={{
                left: `${block.x}px`,
                top: `${block.y}px`,
                width: `${block.size * 2}px`,
                height: `${block.size}px`,
                backgroundColor: block.color,
                zIndex: 10,
                ...animationStyle,
              }}
            >
              {/* Block content with icon and text */}
              <div className="w-full h-full flex items-center p-3 relative">
                {/* Icon - centered vertically */}
                <div className="w-12 h-12 flex-shrink-0">
                  <img
                    src={iconSrc || "/placeholder.svg"}
                    alt={block.iconType}
                    className="w-full h-full object-contain"
                    draggable="false"
                  />
                </div>

                {/* Text content - left aligned, black text */}
                <div className="flex flex-col justify-center ml-3 flex-1">
                  <h3 className="text-black font-bold text-sm mb-1">{block.title}</h3>
                  <p className="text-black/80 text-xs">{block.description}</p>
                </div>

                {/* Inner shine effect */}
                <div
                  className="absolute inset-0 rounded-lg opacity-20 pointer-events-none"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, transparent)",
                  }}
                ></div>
              </div>
            </div>
          )
        })}
        {/* Mouse trail */}
        {gameState === "playing" &&
          trail.map((pos, index) => (
            <div
              key={index}
              className="absolute pointer-events-none z-30"
              style={{
                left: pos.x - 3,
                top: pos.y - 3,
                width: 6,
                height: 6,
                backgroundColor: "#fff",
                borderRadius: "50%",
                opacity: (index + 1) / trail.length,
                transform: `scale(${(index + 1) / trail.length})`,
              }}
            />
          ))}

        {/* Custom cursor */}
        {gameState === "playing" && (
          <div
            className="absolute pointer-events-none z-40"
            style={{
              left: mousePosition.x - 10,
              top: mousePosition.y - 10,
              width: 20,
              height: 20,
              backgroundColor: isMouseDown ? "#ff6b6b" : "#fff",
              borderRadius: "50%",
              boxShadow: "0 0 15px rgba(255,255,255,0.8)",
              transition: "background-color 0.1s ease",
            }}
          />
        )}
      </div>

      {/* Footer with Logo, Score and Timer - Matching the reference image style */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-r from-blue-400/80 via-blue-500/80 to-blue-600/80 backdrop-blur-md flex justify-between items-center shadow-lg"
        style={{
          fontFamily: "Orbitron, monospace",
          zIndex: 100,
          backgroundImage: `url('/footer-bg.png')`,
          backgroundSize: "100% 100%",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="bg-gradient-to-r from-blue-300/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm"
            style={{ backgroundImage: `url('/footer-bg.png')`, backgroundSize: "100% 100%" }}
          >
            <div className="w-20 h-12">
              <img src="/bark-logo.svg" alt="BARK Logo" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Player name display */}
          {playerName && (
            <div className="bg-gradient-to-r from-blue-300/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 shadow-sm">
              <span className="text-white text-sm font-medium drop-shadow-sm">Player: {playerName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 p-2">
          {/* Difficulty indicator - only show during gameplay */}
          {gameState === "playing" && (
            <div
              className={`backdrop-blur-sm rounded-xl px-4 py-2 border shadow-sm transition-all duration-300 ${
                spawnRateMultiplierRef.current === 1
                  ? "bg-green-500/40 border-green-300/30"
                  : spawnRateMultiplierRef.current === 2
                    ? "bg-yellow-500/40 border-yellow-300/30"
                    : "bg-red-500/40 border-red-300/30"
              }`}
            >
              <span className="text-white text-sm font-medium drop-shadow-sm">{getDifficultyText()} Speed</span>
            </div>
          )}

          {!isMobile && (
            <button
              onClick={toggleFullscreen}
              className="bg-gradient-to-r from-blue-600/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 hover:from-blue-200/50 hover:to-blue-300/50 transition-all duration-200 flex items-center gap-2 border border-white/20 shadow-sm"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <svg
                  className="w-5 h-5 text-white drop-shadow-sm"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9V4.5M15 9H19.5M15 9L20.25 3.75M9 15V19.5M9 15H4.5M9 15L3.75 20.25M15 15V19.5M15 15H19.5M15 15L20.25 20.25"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-white drop-shadow-sm"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
              )}
            </button>
          )}

          {/* Score */}
          <div className="bg-gradient-to-r from-blue-300/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 shadow-sm">
            {!isMobile && <span className="text-white text-sm font-medium drop-shadow-sm">Score:</span>}
            <span
              className={`text-white text-xl font-bold ${!isMobile ? "ml-2" : ""} drop-shadow-md ${
                scoreAnimation === "increase" ? "score-increase" : scoreAnimation === "decrease" ? "score-decrease" : ""
              }`}
            >
              {score}
            </span>
          </div>

          {/* Timer */}
          <div className="bg-gradient-to-r from-blue-300/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 shadow-sm">
            {!isMobile && <span className="text-white text-sm font-medium drop-shadow-sm">Time:</span>}
            <span
              className={`text-white text-xl font-bold ${!isMobile ? "ml-2" : ""} drop-shadow-md ${
                timeLeft <= 10 ? "text-red-300 animate-pulse" : ""
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Help button */}
          <button
            onClick={showIntroAndPause}
            className="bg-gradient-to-r from-blue-600/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 hover:from-blue-200/50 hover:to-blue-300/50 transition-all duration-200 flex items-center gap-2 border border-white/20 shadow-sm"
            title="Help"
          >
            <svg className="w-5 h-5 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Start button - only show when not playing */}
          {gameState !== "playing" && (
            <button
              onClick={startGame}
              className="bg-gradient-to-r from-green-600/40 to-green-400/40 backdrop-blur-sm rounded-xl px-6 py-2 hover:from-green-500/50 hover:to-green-300/50 transition-all duration-200 border border-white/20 shadow-sm"
            >
              <span className="text-white font-bold drop-shadow-sm">
                {gameState === "waiting" ? "Start" : gameState === "gameover" ? "Play Again" : "Resume"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
