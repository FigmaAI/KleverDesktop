import { useState, useEffect } from 'react'
import { Globe, Smartphone, Check, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

interface WebLoginStatus {
    loggedIn: boolean
    lastLoginAt?: string
}

interface AndroidLoginStatus {
    loggedIn: boolean
    deviceId?: string
    lastLoginAt?: string
}

type Platform = 'web' | 'android'

interface GoogleLoginButtonProps {
    platform: Platform
}

const formatDate = (isoString?: string) => {
    if (!isoString) return '-'
    return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/**
 * Web Browser Google Login - With verify support
 */
function WebGoogleLoginButton() {
    const [status, setStatus] = useState<WebLoginStatus>({ loggedIn: false })
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)

    useEffect(() => {
        // Load cached status first (fast)
        loadStatus()
        
        // Then verify actual status in background
        verifyStatus()

        const handleStatus = (statusType: string) => {
            console.log('[WebGoogleLogin] Status:', statusType)
            if (statusType === 'completed') {
                setLoading(false)
                loadStatus()
            } else if (statusType === 'closed' || statusType === 'cancelled') {
                setLoading(false)
            } else if (statusType === 'already_logged_in') {
                // Already logged in - will get 'completed' after dialog confirmation
            }
        }

        const cleanup = window.electronAPI.onGoogleLoginWebStatus(handleStatus)
        return cleanup
    }, [])

    const loadStatus = async () => {
        const result = await window.electronAPI.googleLoginWebGetStatus()
        if (result.success) {
            setStatus({
                loggedIn: result.loggedIn,
                lastLoginAt: result.lastLoginAt,
            })
        }
    }

    const verifyStatus = async () => {
        setVerifying(true)
        try {
            const result = await window.electronAPI.googleLoginWebVerifyStatus()
            console.log('[WebGoogleLogin] Verify result:', result)
            if (result.success && result.verified) {
                setStatus({
                    loggedIn: result.loggedIn,
                    lastLoginAt: result.lastLoginAt,
                })
            }
        } catch (error) {
            console.error('[WebGoogleLogin] Verify error:', error)
        } finally {
            setVerifying(false)
        }
    }

    const handleLogin = async () => {
        setLoading(true)
        const result = await window.electronAPI.googleLoginWebStart()
        if (!result.success) {
            console.error('[WebGoogleLogin] Start error:', result.error)
            setLoading(false)
        }
    }

    const handleStop = async () => {
        await window.electronAPI.googleLoginWebStop()
        setLoading(false)
    }

    return (
        <TooltipProvider>
            <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Web Browser Google Login</Label>
                        <span className="text-xs text-muted-foreground">(Optional)</span>
                        {verifying && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {loading ? (
                            <Button variant="outline" size="sm" onClick={handleStop}>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Cancel
                            </Button>
                        ) : status.loggedIn ? (
                            <>
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(status.lastLoginAt)}
                                </span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="secondary" size="sm" onClick={handleLogin}>
                                            <Check className="h-4 w-4 mr-2 text-green-600" />
                                            Re-login
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Pre-authenticate with Google for web automation</p>
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="sm" onClick={handleLogin}>
                                        Login
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Pre-authenticate with Google for web automation</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}

/**
 * Android Device Google Login - Similar layout to Web login
 */
function AndroidGoogleLoginButton() {
    const [status, setStatus] = useState<AndroidLoginStatus>({ loggedIn: false })
    const [loading, setLoading] = useState(false)
    const [devices, setDevices] = useState<string[]>([])
    const [selectedDevice, setSelectedDevice] = useState<string>('')
    const [loadingDevices, setLoadingDevices] = useState(false)

    useEffect(() => {
        // Load status on mount
        const fetchStatus = async () => {
            const result = await window.electronAPI.googleLoginAndroidGetStatus()
            if (result.success) {
                setStatus({
                    loggedIn: result.loggedIn,
                    deviceId: result.deviceId,
                    lastLoginAt: result.lastLoginAt,
                })
            }
        }
        
        // Load devices on mount
        const fetchDevices = async () => {
            setLoadingDevices(true)
            const result = await window.electronAPI.googleLoginAndroidListDevices()
            if (result.success) {
                setDevices(result.devices)
                if (result.devices.length > 0) {
                    setSelectedDevice(result.devices[0])
                }
            }
            setLoadingDevices(false)
        }
        
        fetchStatus()
        fetchDevices()

        const handleStatus = (statusType: string, message?: string) => {
            console.log('[AndroidGoogleLogin] Status:', statusType, message)
            if (statusType === 'completed') {
                setLoading(false)
                fetchStatus()
                // Refresh device list after successful login
                fetchDevices()
            } else if (statusType === 'timeout' || statusType === 'cancelled' || statusType === 'closed' || statusType === 'error') {
                setLoading(false)
            } else if (statusType === 'emulator_ready' || statusType === 'device_found') {
                // Refresh device list when new device is ready
                fetchDevices()
            }
        }

        const cleanup = window.electronAPI.onGoogleLoginAndroidStatus(handleStatus)
        return cleanup
    }, [])

    const loadDevices = async () => {
        setLoadingDevices(true)
        const result = await window.electronAPI.googleLoginAndroidListDevices()
        if (result.success) {
            setDevices(result.devices)
            if (result.devices.length > 0 && !selectedDevice) {
                setSelectedDevice(result.devices[0])
            }
        }
        setLoadingDevices(false)
    }

    const handleLogin = async (deviceId?: string) => {
        const targetDevice = deviceId || selectedDevice || devices[0] || ''
        
        // Start login - Python script will handle device detection and emulator start
        setLoading(true)
        const result = await window.electronAPI.googleLoginAndroidStart(targetDevice)
        if (!result.success) {
            console.error('[AndroidGoogleLogin] Start error:', result.error)
            setLoading(false)
        }
    }

    const handleStop = async () => {
        await window.electronAPI.googleLoginAndroidStop()
        setLoading(false)
    }

    return (
        <TooltipProvider>
            <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Android Google Login</Label>
                        <span className="text-xs text-muted-foreground">(Optional)</span>
                        {loadingDevices && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {loading ? (
                            <Button variant="outline" size="sm" onClick={handleStop}>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Cancel
                            </Button>
                        ) : status.loggedIn ? (
                            <>
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(status.lastLoginAt)}
                                </span>
                                {devices.length > 1 && (
                                    <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                                        <SelectTrigger className="w-[140px] h-8 text-xs">
                                            <SelectValue placeholder="Device" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {devices.map((device) => (
                                                <SelectItem key={device} value={device} className="text-xs">
                                                    {device}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="secondary" size="sm" onClick={() => handleLogin()}>
                                            <Check className="h-4 w-4 mr-2 text-green-600" />
                                            Re-login
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Pre-authenticate with Google for Android automation</p>
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        ) : (
                            <>
                                {devices.length > 1 && (
                                    <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                                        <SelectTrigger className="w-[140px] h-8 text-xs">
                                            <SelectValue placeholder="Device" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {devices.map((device) => (
                                                <SelectItem key={device} value={device} className="text-xs">
                                                    {device}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={loadDevices}
                                >
                                    <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="sm" onClick={() => handleLogin()}>
                                            Login
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Pre-authenticate with Google for Android automation</p>
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </div>
                </div>

                {/* Device Login History */}
                {status.loggedIn && status.deviceId && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="h-7 text-xs px-2">Device</TableHead>
                                <TableHead className="h-7 text-xs px-2">Last Login</TableHead>
                                <TableHead className="h-7 text-xs px-2 w-16">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="py-1.5 px-2 text-xs font-mono">
                                    {status.deviceId}
                                </TableCell>
                                <TableCell className="py-1.5 px-2 text-xs text-muted-foreground">
                                    {formatDate(status.lastLoginAt)}
                                </TableCell>
                                <TableCell className="py-1.5 px-2">
                                    <span className="inline-flex items-center text-xs text-green-600">
                                        <Check className="h-3 w-3 mr-1" />
                                        OK
                                    </span>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                )}
            </div>
        </TooltipProvider>
    )
}

/**
 * Google Login Button - use platform prop to choose which one to render
 */
export function GoogleLoginButton({ platform }: GoogleLoginButtonProps) {
    if (platform === 'web') {
        return <WebGoogleLoginButton />
    }
    return <AndroidGoogleLoginButton />
}

export { WebGoogleLoginButton, AndroidGoogleLoginButton }

export function GoogleLoginCard() {
    return (
        <div className="space-y-6">
            <WebGoogleLoginButton />
            <AndroidGoogleLoginButton />
        </div>
    )
}

export function GoogleLoginSection() {
    return <GoogleLoginCard />
}
