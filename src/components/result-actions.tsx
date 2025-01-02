'use client'

import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import { Check, Copy, Download } from "lucide-react"
import { useState } from "react"

export function ResultActions({ result }: { result: string }) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1000)
  }

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "llms.txt"
    a.click()
  }

  return (
    <CardFooter className="flex gap-2">
      <Button onClick={handleCopy} className="flex-1">
        {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {isCopied ? "Copied" : "Copy"}
      </Button>
      <Button onClick={handleDownload} className="flex-1">
        <Download className="mr-2 h-4 w-4" /> Download
      </Button>
    </CardFooter>
  )
}