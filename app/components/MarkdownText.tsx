import React from 'react'

interface MarkdownTextProps {
  content: string
}

export default function MarkdownText({ content }: MarkdownTextProps) {
  const parseMarkdown = (text: string) => {
    const elements: React.ReactNode[] = []
    let currentIndex = 0
    let key = 0

    // Split by line breaks first to handle lists
    const lines = text.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      const lineElements: React.ReactNode[] = []
      let lineIndex = 0

      // Check for bullet points
      const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*')
      if (isBullet && line.trim().length > 1) {
        line = line.trim().substring(1).trim()
      }

      while (lineIndex < line.length) {
        // Bold **text**
        const boldMatch = line.slice(lineIndex).match(/^\*\*(.+?)\*\*/)
        if (boldMatch) {
          lineElements.push(
            <strong key={`${key++}`} className="font-semibold">
              {boldMatch[1]}
            </strong>
          )
          lineIndex += boldMatch[0].length
          continue
        }

        // Italic *text* or _text_
        const italicMatch = line.slice(lineIndex).match(/^[*_](.+?)[*_]/)
        if (italicMatch && !line.slice(lineIndex).startsWith('**')) {
          lineElements.push(
            <em key={`${key++}`} className="italic">
              {italicMatch[1]}
            </em>
          )
          lineIndex += italicMatch[0].length
          continue
        }

        // Code `text`
        const codeMatch = line.slice(lineIndex).match(/^`(.+?)`/)
        if (codeMatch) {
          lineElements.push(
            <code key={`${key++}`} className="bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono">
              {codeMatch[1]}
            </code>
          )
          lineIndex += codeMatch[0].length
          continue
        }

        // Regular text
        const nextSpecial = line.slice(lineIndex).search(/[*_`]/)
        const textEnd = nextSpecial === -1 ? line.length : lineIndex + nextSpecial
        if (textEnd > lineIndex) {
          lineElements.push(
            <span key={`${key++}`}>{line.slice(lineIndex, textEnd)}</span>
          )
          lineIndex = textEnd
        } else {
          lineIndex++
        }
      }

      // Wrap line in appropriate element
      if (isBullet) {
        elements.push(
          <li key={`line-${i}`} className="ml-4">
            {lineElements}
          </li>
        )
      } else if (lineElements.length > 0) {
        elements.push(
          <span key={`line-${i}`} className="block">
            {lineElements}
          </span>
        )
      } else {
        // Empty line
        elements.push(<br key={`line-${i}`} />)
      }
    }

    return elements
  }

  return <div className="whitespace-pre-wrap">{parseMarkdown(content)}</div>
}
