import { useRef, useEffect } from 'react'
import { CheckCircle, Download, TerminalSquare, ExternalLink, AlertTriangle } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Terminal, AnimatedSpan } from '@/components/ui/terminal'
import { useTerminal } from '@/hooks/useTerminal'
import { renderAnsi } from '@/utils/ansiParser'
import { useTranslation } from 'react-i18next'

interface RecommendedModel {
    name: string
    description: string
    id: string // e.g., 'ahmadwaqar/gelab-zero-4b-preview'
}

interface LocalModelSetupStepProps {
    recommendedModel: RecommendedModel
    isInstalling: boolean
    isSuccess: boolean
    ollamaInstalled: boolean | null  // null = not checked yet
    onInstall: (modelId: string) => void
}

export function LocalModelSetupStep({
    recommendedModel,
    isInstalling,
    isSuccess,
    ollamaInstalled,
    onInstall,
}: LocalModelSetupStepProps) {
    const { t } = useTranslation()
    const { lines } = useTerminal()
    const outputRef = useRef<HTMLDivElement>(null)

    // Filter lines for ollama source
    const ollamaLines = lines.filter((line) => line.source === 'ollama')

    // Auto-scroll to bottom when new lines are added
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
    }, [ollamaLines])

    return (
        <BlurFade key="step-local-model" delay={0.1}>
            <Card className="h-full min-h-[480px]">
                <CardContent className="p-6 h-full">
                    <div className="grid grid-cols-8 gap-6 h-full">
                        {/* Left: Model Info and Controls */}
                        <div className="col-span-3 space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold">{t('setup.localModelStep.label')}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t('setup.localModelStep.description')}
                                </p>
                            </div>

                            <Card className="border-primary/20 bg-primary/5">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Download className="h-5 w-5 text-primary" />
                                        <h4 className="font-medium text-primary">
                                            {t('setup.localModelStep.recommendTitle')}
                                        </h4>
                                    </div>

                                    <div>
                                        <div className="font-semibold text-foreground">{recommendedModel.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1 break-all font-mono bg-background/50 p-1 rounded">
                                            {recommendedModel.id}
                                        </div>
                                    </div>

                                    <p className="text-sm text-muted-foreground">
                                        {recommendedModel.description}
                                    </p>

                                    <div
                                        className="text-xs text-primary/80 font-medium pt-1 flex items-center gap-1.5 cursor-pointer hover:underline hover:text-primary transition-colors"
                                        onClick={() => window.electronAPI.openExternal('https://github.com/stepfun-ai/gelab-zero')}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        {t('setup.localModelStep.notice')}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Install Button */}
                            {!isSuccess ? (
                                <div className="space-y-3">
                                    {ollamaInstalled === false && (
                                        <Alert className="bg-yellow-500/10 border-yellow-500/20">
                                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                            <AlertTitle className="text-yellow-600 font-semibold mb-1">
                                                {t('setup.ollamaNotInstalled')}
                                            </AlertTitle>
                                            <AlertDescription className="text-yellow-600/90 text-xs">
                                                {t('setup.ollamaNotInstalledDesc')}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <Button
                                        onClick={() => onInstall(recommendedModel.id)}
                                        className="w-full"
                                        disabled={isInstalling || ollamaInstalled === false}
                                    >
                                        {isInstalling ? (
                                            <>
                                                <TerminalSquare className="h-4 w-4" />
                                                {t('setup.localModelStep.installingButton')}
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-4 w-4" />
                                                {t('setup.localModelStep.installButton')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <Alert className="bg-green-500/10 border-green-500/20">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <AlertTitle className="text-green-600 font-semibold mb-1">
                                        {t('setup.localModelStep.successMessage')}
                                    </AlertTitle>
                                    <AlertDescription className="text-green-600/90 text-xs">
                                        {t('setup.localModelStep.successDescription')}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Right: Terminal Output */}
                        <div className="col-span-5 flex h-full flex-col min-h-0">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <TerminalSquare className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">{t('setup.localModelStep.terminalLog')}</span>
                            </div>

                            <div className="flex-1 overflow-hidden rounded-lg border bg-black">
                                <div ref={outputRef} className="h-full overflow-y-auto p-0">
                                    <Terminal
                                        sequence={false}
                                        className="h-full border-0 rounded-none max-w-none min-h-full"
                                        title={t('setup.localModelStep.terminalTitle')}
                                    >
                                        {ollamaLines.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 py-10">
                                                <Download className="h-8 w-8 mb-2 opacity-20" />
                                                <AnimatedSpan className="text-xs">
                                                    {t('setup.localModelStep.terminalPlaceholder')}
                                                </AnimatedSpan>
                                            </div>
                                        ) : (
                                            <>
                                                {ollamaLines.map((line) => (
                                                    <AnimatedSpan key={line.id} className="font-mono text-xs">
                                                        {renderAnsi(line.content)}
                                                    </AnimatedSpan>
                                                ))}
                                            </>
                                        )}
                                    </Terminal>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </BlurFade>
    )
}
