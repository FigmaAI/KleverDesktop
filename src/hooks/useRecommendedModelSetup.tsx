import { useState, useCallback, useEffect } from 'react'
import { useTerminal } from './useTerminal'

export interface RecommendedModelSetup {
    isInstalling: boolean
    isSuccess: boolean
    error: string | null
    ollamaInstalled: boolean | null  // null = not checked yet
    checkOllamaInstalled: () => Promise<boolean>
    startInstall: (modelName: string, onOllamaNotInstalled?: () => void) => Promise<void>
}

export function useRecommendedModelSetup(targetModelId?: string): RecommendedModelSetup {
    const { addLine, addProcess, updateProcess, setIsOpen } = useTerminal()
    const [isInstalling, setIsInstalling] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null)

    // Check if Ollama is installed
    const checkOllamaInstalled = useCallback(async (): Promise<boolean> => {
        try {
            const result = await window.electronAPI.ollamaCheck()
            const installed = result.installed
            setOllamaInstalled(installed)
            return installed
        } catch (e) {
            console.error('[useRecommendedModelSetup] Failed to check Ollama installation:', e)
            setOllamaInstalled(false)
            return false
        }
    }, [])

    // Check Ollama installation on mount
    useEffect(() => {
        checkOllamaInstalled()
    }, [checkOllamaInstalled])

    // Check if model is already installed on mount
    useEffect(() => {
        if (!targetModelId) return

        const checkInstalled = async () => {
            try {
                // We use ollamaList which returns { success: boolean, models: string[] }
                const result = await window.electronAPI.ollamaList()
                if (result.success && result.models) {
                    // Check for exact match or match specific tag logic if needed
                    // For now, exact match of the full string or the 'latest' implicit
                    const isInstalled = result.models.some(m =>
                        m === targetModelId ||
                        m === `${targetModelId}:latest` ||
                        (targetModelId.endsWith(':latest') && m === targetModelId.replace(':latest', ''))
                    )

                    if (isInstalled) {
                        setIsSuccess(true)
                    }
                }
            } catch (e) {
                console.error('[useRecommendedModelSetup] Failed to check cached models:', e)
            }
        }

        checkInstalled()
    }, [targetModelId])

    // Listen for ollama pull progress...

    const startInstall = useCallback(async (modelName: string, onOllamaNotInstalled?: () => void) => {
        // First, check if Ollama is installed
        const installed = await checkOllamaInstalled()
        if (!installed) {
            setError('Ollama is not installed')
            if (onOllamaNotInstalled) {
                onOllamaNotInstalled()
            }
            return
        }

        setIsInstalling(true)
        setIsSuccess(false)
        setError(null)
        setIsOpen(true) // Auto open terminal

        const processId = `ollama-pull-${Date.now()}`

        addProcess({
            id: processId,
            name: `Pull ${modelName}`,
            type: 'ollama',
            status: 'running',
        })

        addLine({
            source: 'ollama',
            sourceId: processId,
            type: 'system',
            content: `Starting download of model: ${modelName}...`,
        })

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = await window.electronAPI.ollamaPull(modelName)

            if (result.success) {
                setIsSuccess(true)
                updateProcess(processId, {
                    status: 'completed',
                    hasError: false,
                    exitCode: 0
                })
                addLine({
                    source: 'ollama',
                    sourceId: processId,
                    type: 'system',
                    content: `Successfully installed ${modelName}!`,
                })
            } else {
                throw new Error(result.error || 'Unknown error occurred during installation')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            setError(errorMessage)
            updateProcess(processId, {
                status: 'failed',
                hasError: true,
                exitCode: 1
            })
            addLine({
                source: 'ollama',
                sourceId: processId,
                type: 'stderr',
                content: `Installation failed: ${errorMessage}`,
            })
        } finally {
            setIsInstalling(false)
        }
    }, [addProcess, addLine, updateProcess, setIsOpen, checkOllamaInstalled])

    return {
        isInstalling,
        isSuccess,
        error,
        ollamaInstalled,
        checkOllamaInstalled,
        startInstall,
    }
}
