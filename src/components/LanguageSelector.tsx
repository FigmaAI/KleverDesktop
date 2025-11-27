import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface Language {
  code: string
  name: string
  nativeName: string
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
]

interface LanguageSelectorProps {
  value?: string
  onChange: (value: string) => void
  required?: boolean
  label?: string
  description?: string
}

export function LanguageSelector({
  value,
  onChange,
  required = false,
  label,
  description,
}: LanguageSelectorProps) {
  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="language">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select value={value || 'en'} onValueChange={onChange}>
        <SelectTrigger id="language">
          <SelectValue placeholder="Select a language" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeName} ({lang.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
