'use client'

import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import { Check, Copy, Download } from "lucide-react"
import { startTransition, useOptimistic } from "react"

export function ResultActions({ result }: { result: string }) {
  const [isCopied, setIsCopied] = useOptimistic(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    startTransition(async() => {
      setIsCopied(true)
      await new Promise(resolve => setTimeout(resolve, 1000))
    })
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
    <CardFooter className="flex gap-4">
      <Button onClick={handleCopy} variant="outline" className="flex-1">
        {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {isCopied ? "Copied" : "Copy"}
      </Button>
      <Button onClick={handleDownload} variant="outline" className="flex-1">
        <Download className="mr-2 h-4 w-4" /> Download
      </Button>
    </CardFooter>
  )
}