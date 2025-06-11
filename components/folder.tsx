import type React from "react"

interface FolderProps {
  title: string
  x: number
  y: number
}

export const Folder: React.FC<FolderProps> = ({ title, x, y }) => {
  return (
    <div
      className="absolute flex flex-col items-center pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className="w-16 h-14 mb-1">
        <img src="/folder-icon.png" alt="Folder" className="w-full h-full object-contain" />
      </div>
      <div className="bg-white/70 backdrop-blur-sm px-3 py-1 rounded-md shadow-sm">
        <span className="text-slate-800 text-sm font-medium">{title}</span>
      </div>
    </div>
  )
}
