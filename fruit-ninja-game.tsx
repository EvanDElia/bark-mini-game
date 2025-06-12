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
  spawnTime: number // Add spawn time to track when block was created
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

      console.log(updatedScores);

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

    return {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (width - 120) + 20, // Add some padding
      y: Math.random() * (height - 300) + 100, // Increased bottom padding to avoid footer
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 80, // Fixed size for now
      isSliced: false,
      justSpawned: true,
      isAnimatingOut: false,
      spawnTime: Date.now(), // Track when the block was created
    }
  }, [colors])

  // Manual spawn for testing
  const spawnTestBlock = useCallback(() => {
    const newBlock = generateBlock()
    console.log("Spawning test block:", newBlock)
    setBlocks((prev) => [...prev, newBlock])
  }, [generateBlock])

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
    setTimeLeft(40) // Reset timer to 60 seconds
    setBlocks([])
    setTrail([])
    setIsNewHighScore(false)
    setShowScoresModal(false) // Close scores modal when starting new game

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

    // Start block spawning
    spawnIntervalRef.current = setInterval(
      () => {
        setBlocks((prev) => {
          const filtered = prev.filter((block) => !block.isSliced && !block.isAnimatingOut)
          if (filtered.length < 5) {
            const newBlock = generateBlock()
            return [...filtered, newBlock]
          }
          return filtered
        })
      },
      1000 + Math.random() * 500,
    )

    // Start timer countdown
    timerIntervalRef.current = setInterval(() => {
      console.log(score);
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          // Game over when timer reaches 0
          endGame()
          return 0
        }
        return prevTime - 1
      })
    }, 1000)
  }, [generateBlock])

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
    const distance = Math.sqrt(
      Math.pow(mousePos.x - (block.x + block.size / 2), 2) + Math.pow(mousePos.y - (block.y + block.size / 2), 2),
    )
    return distance < block.size / 2
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
    if (gameState == "gameover") endGame();
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
  // useEffect(() => {
  //   const timeout = setTimeout(() => {
  //     setBlocks((prev) => prev.map((block) => ({ ...block, justSpawned: false })))
  //   }, 500)

  //   return () => clearTimeout(timeout)
  // }, [blocks])

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (redBlockTimeoutRef.current) clearInterval(redBlockTimeoutRef.current)
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
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(-90deg);
            opacity: 0.8;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes celebration {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-5deg); }
          75% { transform: scale(1.1) rotate(5deg); }
        }
      `}</style>

      {/* Game Controls */}
      <div className="absolute z-50 top-4 right-4 flex gap-2 flex-col">
        {gameState === "playing" && (
          <>
            <button
              onClick={stopGame}
              className="z-50 bg-gradient-to-r from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-6 rounded-xl transition-all duration-200 shadow-lg backdrop-blur-sm border border-white/20"
            >
              Stop Game
            </button>
            <button
              onClick={spawnTestBlock}
              className="z-50 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-all duration-200 shadow-lg backdrop-blur-sm border border-white/20"
            >
              Spawn Block
            </button>
            <button
              onClick={addFolder}
              className="z-50 bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all duration-200 shadow-lg backdrop-blur-sm border border-white/20"
            >
              Add Folder
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      {gameState === "waiting" && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="bg-gradient-to-br from-blue-400/30 to-blue-600/30 backdrop-blur-lg rounded-2xl p-8 text-center max-w-2xl border border-white/20 shadow-2xl">
            <h1 className="text-white text-4xl font-bold mb-4">Welcome</h1>
            <p className="text-white text-lg mb-4">
              Click and drag your mouse over the colored blocks to slice them and earn points!
            </p>
            <p className="text-white text-lg mb-4">You have 60 seconds to score as many points as possible!</p>

            <div className="flex flex-col gap-3 mb-6">
              <div className="bg-gradient-to-r from-blue-400/10 to-blue-600/10 rounded-xl p-4 border border-blue-300/20 text-left">
                <h3 className="text-white font-bold mb-2 text-lg">Game Rules:</h3>
                <ul className="list-disc pl-5 space-y-2 text-white/90">
                  <li>
                    Regular colored blocks: <span className="text-white font-bold">+20 points</span>
                  </li>
                  <li>
                    <span className="inline-block w-4 h-4 bg-[#ff6b6b] rounded-full mr-2 align-middle"></span>
                    Red blocks: <span className="text-red-300 font-bold">-20 points</span> (avoid these!)
                  </li>
                  <li>
                    <span className="text-yellow-300 font-bold">Red blocks disappear after 8 seconds</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* High Score Display */}
            {getCurrentHighScore() > 0 && (
              <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-xl p-4 mb-6 border border-yellow-300/30">
                <p className="text-yellow-200 text-sm mb-1">Current High Score</p>
                <p className="text-white text-3xl font-bold">{getCurrentHighScore()}</p>
              </div>
            )}

            <button
              onClick={startGame}
              className="bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg text-xl border border-white/20"
            >
              Start Playing
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameState === "gameover" && !showScoresModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-slate-700/90 to-slate-900/90 backdrop-blur-lg rounded-2xl p-10 text-center max-w-2xl border border-white/20 shadow-2xl">
            <h1 className="text-white text-5xl font-bold mb-4">Game Over!</h1>

            {/* New High Score Celebration */}
            {isNewHighScore && (
              <div
                className="mb-6 p-4 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-xl border border-yellow-300/30"
                style={{ animation: "celebration 0.6s ease-in-out" }}
              >
                <p className="text-yellow-300 text-xl font-bold mb-2">🎉 NEW HIGH SCORE! 🎉</p>
                <p className="text-white text-sm">You made it to the top 3!</p>
              </div>
            )}

            <div className="mb-8 mt-6">
              <div className="text-white text-7xl font-bold mb-2">{score}</div>
              <p className="text-white/80 text-xl">Final Score</p>
            </div>

            {/* High Scores List */}
            {highScores.length > 0 && (
              <div className="mb-8 bg-gradient-to-r from-blue-400/10 to-blue-600/10 rounded-xl p-4 border border-blue-300/20">
                <h3 className="text-white text-lg font-bold mb-3">High Scores</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {highScores.slice(0, 5).map((highScore, index) => (
                    <div key={highScore.timestamp} className="flex justify-between items-center text-sm">
                      <span className="text-white/80">#{index + 1}</span>
                      <span className="text-white font-bold">{highScore.score}</span>
                      <span className="text-white/60">{highScore.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={startGame}
                className="bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg text-xl border border-white/20 flex-1"
              >
                Play Again
              </button>
              <button
                onClick={() => setShowScoresModal(true)}
                className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg text-xl border border-white/20 flex-1"
              >
                Scores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scores Modal */}
      {showScoresModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-slate-700/95 to-slate-900/95 backdrop-blur-lg rounded-2xl p-8 max-w-4xl w-full mx-4 border border-white/20 shadow-2xl max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white text-3xl font-bold">High Scores</h2>
              <button
                onClick={() => setShowScoresModal(false)}
                className="text-white/60 hover:text-white transition-colors duration-200 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex mb-6 bg-gradient-to-r from-slate-600/40 to-slate-700/40 rounded-xl p-1 border border-white/10">
              <button
                onClick={() => setActiveScoreTab("user")}
                className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all duration-200 ${
                  activeScoreTab === "user"
                    ? "bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-lg"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                User
              </button>
              <button
                onClick={() => setActiveScoreTab("global")}
                className={`flex-1 py-3 px-6 rounded-lg font-bold transition-all duration-200 ${
                  activeScoreTab === "global"
                    ? "bg-gradient-to-r from-blue-400 to-blue-600 text-white shadow-lg"
                    : "text-white/70 hover:text-white hover:bg-white/10"
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
                          className="bg-gradient-to-r from-blue-400/10 to-blue-600/10 rounded-xl p-4 border border-blue-300/20 flex justify-between items-center"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center font-bold text-white text-sm">
                              #{index + 1}
                            </div>
                            <div>
                              <div className="text-white text-xl font-bold">{highScore.score}</div>
                              <div className="text-white/60 text-sm">{highScore.date}</div>
                            </div>
                          </div>
                          {index === 0 && <div className="text-yellow-400 text-2xl">👑</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-white/60 text-xl mb-2">No scores yet!</div>
                      <div className="text-white/40">Play a game to see your scores here.</div>
                    </div>
                  )}
                </div>
              )}

              {activeScoreTab === "global" && (
                <div className="text-center py-12">
                  <div className="text-white/60 text-xl mb-2">Global Leaderboard</div>
                  <div className="text-white/40">Coming soon...</div>
                  <div className="mt-6 text-white/30 text-sm">Global scores will be available in a future update!</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={() => setShowScoresModal(false)}
                className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 border border-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className={`w-full h-full relative ${gameState === "playing" ? "cursor-none" : "cursor-default"} pb-20 z-10`}
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
            block.justSpawned = false;
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
            animationClass = "scale-100 opacity-100 hover:scale-105 transition-all duration-200"
          }

          return (
            <div
              key={block.id}
              className={`absolute rounded-xl shadow-2xl border-2 border-white/30 ${animationClass}`}
              style={{
                left: `${block.x}px`,
                top: `${block.y}px`,
                width: `${block.size}px`,
                height: `${block.size}px`,
                backgroundColor: block.color,
                zIndex: 10,
                ...animationStyle,
              }}
            >
              {/* Inner shine effect */}
              <div
                className="absolute inset-2 rounded-lg opacity-40"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, transparent 60%)",
                }}
              />
              {/* Center dot for visibility */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />
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
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-r from-blue-400/80 via-blue-500/80 to-blue-600/80 backdrop-blur-md p-4 flex justify-between items-center border-t border-white/20 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-r from-blue-300/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-3 border border-white/20 shadow-sm">
            <div className="w-20 h-8">
              <img src="/bark-logo.svg" alt="BARK Logo" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleFullscreen}
            className="bg-gradient-to-r from-blue-300/40 to-blue-400/40 backdrop-blur-sm rounded-xl px-4 py-2 hover:from-blue-200/50 hover:to-blue-300/50 transition-all duration-200 flex items-center gap-2 border border-white/20 shadow-sm"
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
              <svg className="w-5 h-5 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15m-5.25 5.25v-4.5m0 4.5h4.5m-4.5 0L9 15"
                />
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
            <span className="text-white text-xl font-bold drop-shadow-sm">Score: {score} PTS</span>
          </div> {/* 
          <div className="bg-gradient-to-r from-slate-600/60 to-slate-700/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 shadow-sm">
            <span className="text-white text-xl font-bold drop-shadow-sm">Blocks: {blocks.length}</span>
          </div>  */}
          <div
            className={`bg-gradient-to-r from-slate-600/60 to-slate-700/60 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20 shadow-sm ${
              timeLeft <= 10 ? "animate-pulse from-red-500/60 to-red-600/60" : ""
            }`}
          >
            <span className="text-white text-xl font-bold drop-shadow-sm">Time: {formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
