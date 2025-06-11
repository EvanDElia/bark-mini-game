interface FolderData {
  id: string
  title: string
  x: number
  y: number
}

export class FolderGenerator {
  private folders: FolderData[] = []

  constructor(private maxFolders = 10) {}

  generateFolder(title: string, x?: number, y?: number): FolderData {
    // Generate random position if not provided
    const randomX = x ?? Math.floor(Math.random() * (window.innerWidth - 150))
    const randomY = y ?? Math.floor(Math.random() * (window.innerHeight - 250))

    const newFolder: FolderData = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      x: randomX,
      y: randomY,
    }

    // Add to folders array, maintaining max limit
    this.folders.push(newFolder)
    if (this.folders.length > this.maxFolders) {
      this.folders.shift() // Remove oldest folder
    }

    return newFolder
  }

  generateRandomFolders(count: number): FolderData[] {
    const folderNames = [
      "Documents",
      "Pictures",
      "Music",
      "Videos",
      "Downloads",
      "Projects",
      "Work",
      "Personal",
      "Archive",
      "Backup",
      "Games",
      "Apps",
    ]

    const newFolders: FolderData[] = []

    for (let i = 0; i < count; i++) {
      const randomName = folderNames[Math.floor(Math.random() * folderNames.length)]
      const folder = this.generateFolder(`${randomName} ${i + 1}`)
      newFolders.push(folder)
    }

    return newFolders
  }

  getFolders(): FolderData[] {
    return [...this.folders]
  }

  clearFolders(): void {
    this.folders = []
  }
}
