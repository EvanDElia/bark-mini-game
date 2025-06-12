"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Folder } from "./components/folder"
import { FolderGenerator } from "./utils/folder-generator"

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

  // Block titles and descriptions
  const blockTitles = ["Task", "Project", "Meeting", "Reminder", "Event", "Alert", "Update", "Message"]

  const blockDescriptions = [
    "High priority",
    "Due today",
    "Needs review",
    "In progress",
    "Completed",
    "New item",
    "Pending",
    "Urgent",
  ]

  const dangerTitles = ["Warning", "Danger", "Critical", "Alert", "Error"]

  const dangerDescriptions = ["System failure", "Security breach", "Fatal error", "Data loss", "Malfunction"]

  // Initialize folder generator
  useEffect(() => {
    folderGeneratorRef.current = new FolderGenerator(15)

    // Generate some initial folders
    if (folderGeneratorRef.current) {
      const initialFolders = folderGeneratorRef.current.generateRandomFolders(8)
      setFolders(initialFolders)
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

      console.log(updatedScores)

      saveHighScores(updatedScores)
    },
    [highScores, saveHighScores],
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

  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff"]

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  // Generate random block
  const generateBlock = useCallback((): Block => {
    // Use window dimensions as fallback
    const width = window.innerWidth
    const height = window.innerHeight

    // Randomly select color
    const colorIndex = Math.floor(Math.random() * colors.length)
    const color = colors[colorIndex]

    // Determine if this is a red block
    const isRedBlock = color === "#ff6b6b"

    // Select appropriate title and description based on block type
    const title = isRedBlock
      ? dangerTitles[Math.floor(Math.random() * dangerTitles.length)]
      : blockTitles[Math.floor(Math.random() * blockTitles.length)]

    const description = isRedBlock
      ? dangerDescriptions[Math.floor(Math.random() * dangerDescriptions.length)]
      : blockDescriptions[Math.floor(Math.random() * blockDescriptions.length)]

    // Determine icon type
    const iconType = isRedBlock ? "skull" : Math.random() > 0.5 ? "star" : "people"

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
    }
  }, [colors, blockTitles, blockDescriptions, dangerTitles, dangerDescriptions])

  // Manual spawn for testing
  const spawnTestBlock = useCallback(() => {
    const newBlock = generateBlock()
    console.log("Spawning test block:", newBlock)
    setBlocks((prev) => [...prev, newBlock])
  }, [generateBlock])

  // Update spawn rate based on time left
  const updateSpawnRate = useCallback(
    (secondsLeft: number) => {
      let newMultiplier = 1

      if (secondsLeft <= 10) {
        newMultiplier = 3 // Three times as fast when 10 seconds or less remain
      } else if (secondsLeft <= 30) {
        newMultiplier = 2 // Twice as fast when 30 seconds or less remain
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
              if (filtered.length < 5) {
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
              block.color === "#ff6b6b" &&
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
        if (filtered.length < 5) {
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
            // Check if the block is red (#ff6b6b) and apply negative points
            if (block.color === "#ff6b6b") {
              setScore((s) => s - 10) // Negative points for red blocks
            } else {
              setScore((s) => s + 10) // Positive points for other colors
            }
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
        }

        .system-button:hover {
          background: linear-gradient(to bottom, #4299e1, #3182ce);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .system-button:active {
          background: linear-gradient(to bottom, #2b6cb0, #2c5282);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
          transform: translateY(1px);
        }

        .system-button-green {
          background: linear-gradient(to bottom, #38a169, #2f855a);
        }

        .system-button-green:hover {
          background: linear-gradient(to bottom, #48bb78, #38a169);
        }

        .system-button-green:active {
          background: linear-gradient(to bottom, #2f855a, #276749);
        }

        .system-button-red {
          background: linear-gradient(to bottom, #e53e3e, #c53030);
        }

        .system-button-red:hover {
          background: linear-gradient(to bottom, #f56565, #e53e3e);
        }

        .system-button-red:active {
          background: linear-gradient(to bottom, #c53030, #9b2c2c);
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
                Click and drag your mouse over the colored blocks to close them and earn points!
              </p>
              <p className="text-slate-700 text-lg mb-4">You have 60 seconds to score as many points as possible!</p>

              <div className="flex flex-col gap-3 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-left">
                  <h3 className="text-slate-800 font-bold mb-2 text-lg">Game Rules:</h3>
                  <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    <li>
                      Regular colored blocks: <span className="text-slate-900 font-bold">+10 points</span>
                    </li>
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#ff6b6b] rounded-full mr-2 align-middle"></span>
                      <span className="text-red-600 font-bold">Red blocks: -10 points</span> (avoid these!)
                    </li>
                    <li>
                      <span className="text-amber-600 font-bold">Red blocks disappear after 8 seconds</span>
                    </li>
                    <li>
                      <span className="text-blue-600 font-bold">Blocks spawn faster</span> as time runs out!
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

              <button onClick={startGame} className="system-button system-button-green text-xl px-8 py-3">
                Start Playing
              </button>
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
                Click and drag your mouse over the colored blocks to close them and earn points!
              </p>
              <p className="text-slate-700 text-lg mb-4">You have 60 seconds to score as many points as possible!</p>

              <div className="flex flex-col gap-3 mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-left">
                  <h3 className="text-slate-800 font-bold mb-2 text-lg">Game Rules:</h3>
                  <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    <li>
                      Regular colored blocks: <span className="text-slate-900 font-bold">+10 points</span>
                    </li>
                    <li>
                      <span className="inline-block w-4 h-4 bg-[#ff6b6b] rounded-full mr-2 align-middle"></span>
                      <span className="text-red-600 font-bold">Red blocks: -10 points</span> (avoid these!)
                    </li>
                    <li>
                      <span className="text-amber-600 font-bold">Red blocks disappear after 8 seconds</span>
                    </li>
                    <li>
                      <span className="text-blue-600 font-bold">Blocks spawn faster</span> as time runs out!
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
                  <div className="text-center py-12">
                    <div className="text-slate-500 text-xl mb-2">Global Leaderboard</div>
                    <div className="text-slate-400">Coming soon...</div>
                    <div className="mt-6 text-slate-300 text-sm">
                      Global scores will be available in a future update!
                    </div>
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
        className={`w-full h-full relative ${gameState === "playing" ? "cursor-none" : "cursor-default"} pb-20 z-10 select-none`}
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

          <button
            onClick={toggleFullscreen}
            className="bg-gradient-to-r from-blue-600/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 hover:from-blue-200/50 hover:to-blue-300/50 transition-all duration-200 flex items-center gap-2 border border-white/20 shadow-sm"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 15v4.5M15 15h4.5M15 15l5.25 5.25"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                <path
                  fill="#ffffff"
                  d="m13.28 7.78l3.22-3.22v2.69a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.69l-3.22 3.22a.75.75 0 0 0 1.06 1.06ZM2 17.25v-4.5a.75.75 0 0 1 1.5 0v2.69l3.22-3.22a.75.75 0 0 1 1.06 1.06L4.56 16.5h2.69a.75.75 0 0 1 0 1.5h-4.5a.747.747 0 0 1-.75-.75Zm10.22-3.97l3.22 3.22h-2.69a.75.75 0 0 0 0 1.5h4.5a.747.747 0 0 0 .75-.75v-4.5a.75.75 0 0 0-1.5 0v2.69l-3.22-3.22a.75.75 0 1 0-1.06 1.06ZM3.5 4.56l3.22 3.22a.75.75 0 0 0 1.06-1.06L4.56 3.5h2.69a.75.75 0 0 0 0-1.5h-4.5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0V4.56Z"
                ></path>
              </svg>
            )}
            <span className="text-white text-sm font-medium drop-shadow-sm">
              {isFullscreen ? "Exit" : "Fullscreen"}
            </span>
          </button>

          {/* High Score Display in Footer */}
          {getCurrentHighScore() > 0 && (
            <div className="bg-gradient-to-r from-yellow-500/40 to-orange-500/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-yellow-300/30 shadow-sm">
              <span className="text-white text-sm font-medium drop-shadow-sm">Best: {getCurrentHighScore()}</span>
            </div>
          )}

          <div className="bg-gradient-to-r from-slate-600/60 to-slate-700/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 shadow-sm">
            <span
              className={`text-white text-xl font-bold drop-shadow-sm ${
                scoreAnimation === "increase" ? "score-increase" : scoreAnimation === "decrease" ? "score-decrease" : ""
              }`}
            >
              {score} pts
            </span>
          </div>
          <div
            className={`bg-gradient-to-r from-slate-600/60 to-slate-700/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 shadow-sm ${
              timeLeft <= 10 ? "animate-pulse from-red-500/60 to-red-600/60" : ""
            }`}
          >
            <span className="text-white text-xl font-bold drop-shadow-sm">Time: {formatTime(timeLeft)}</span>
          </div>
          <button
            onClick={showIntroAndPause}
            className="bg-gradient-to-r from-blue-300/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 hover:from-blue-200/50 hover:to-blue-300/50 transition-all duration-200 flex items-center gap-2 border border-white/20 shadow-sm"
            title="Help & Instructions"
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
        </div>
      </div>
    </div>
  )
}
