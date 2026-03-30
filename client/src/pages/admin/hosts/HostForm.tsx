import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Host } from '@/types/api-models';
import { Mic, Play, Volume2 } from 'lucide-react';
import { toast } from 'sonner';


// Helper function to create WAV file from PCM data (24kHz, 16-bit, mono)
const createWavBlob = (pcmData: string) => {
  // Decode base64 to Uint8Array (raw PCM data)
  const binaryString = atob(pcmData);
  const pcmArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmArray[i] = binaryString.charCodeAt(i);
  }

  // WAV file header (44 bytes) for 24kHz, 16-bit, mono PCM
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmArray.length, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // Format chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Chunk size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, 1, true); // Number of channels (mono)
  view.setUint32(24, 24000, true); // Sample rate (24kHz)
  view.setUint32(28, 24000 * 1 * 2, true); // Byte rate (sampleRate * channels * bitsPerSample/8)
  view.setUint16(32, 1 * 2, true); // Block align (channels * bitsPerSample/8)
  view.setUint16(34, 16, true); // Bits per sample

  // Data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmArray.length, true); // Data size

  // Combine header and PCM data
  const wavBuffer = new Uint8Array(header.byteLength + pcmArray.length);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(pcmArray, header.byteLength);

  return new Blob([wavBuffer], { type: 'audio/wav' });
};


// Use Prisma Host type for form data, omitting server-generated fields
type HostFormData = Omit<Host, 'id' | 'createdAt'>;

interface HostFormProps {
  host?: Host;
  onSubmit: (data: HostFormData) => void;
  onCancel: () => void;
}

const HostForm: React.FC<HostFormProps> = ({ host, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<HostFormData>({
    name: host?.name || '',
    bio: host?.bio || '',
    imageUrl: host?.imageUrl || '',
    aiStyle: host?.aiStyle || '',
    aiVoiceId: host?.aiVoiceId || '',
    language: host?.language || 'en-US',
    isActive: host?.isActive ?? true,
  });

  const [multiSpeakerTest, setMultiSpeakerTest] = useState(false);
  const [multiSpeakers, setMultiSpeakers] = useState<Array<{speaker: string, voiceId: string, text: string}>>([
    { speaker: 'Host 1', voiceId: 'Zephyr', text: 'Hello! Welcome to our radio show.' },
    { speaker: 'Host 2', voiceId: 'Puck', text: 'Thanks for joining us today. We have great content prepared.' }
  ]);

  const [availableVoices, setAvailableVoices] = useState<Array<{id: string, name: string, language: string, gender: string, description?: string}>>([]);
  const [testText, setTestText] = useState('Hello, this is a test of the voice generation system.');

  // Update test text when language changes
  useEffect(() => {
    const languageSamples: Record<string, string> = {
      'en-US': 'Hello, this is a test of the voice generation system.',
      'en-IN': 'Hello, this is a test of the voice generation system in Indian English.',
      'es-US': 'Hola, esta es una prueba del sistema de generación de voz.',
      'fr-FR': 'Bonjour, ceci est un test du système de génération de voix.',
      'de-DE': 'Hallo, dies ist ein Test des Sprachgenerierungssystems.',
      'hi-IN': 'नमस्ते, यह वॉइस जनरेशन सिस्टम का एक टेस्ट है।',
      'id-ID': 'Halo, ini adalah tes sistem pembuatan suara.',
      'it-IT': 'Ciao, questo è un test del sistema di generazione vocale.',
      'ja-JP': 'こんにちは、これは音声生成システムのテストです。',
      'ko-KR': '안녕하세요, 이것은 음성 생성 시스템의 테스트입니다.',
      'pt-BR': 'Olá, este é um teste do sistema de geração de voz.',
      'ru-RU': 'Привет, это тест системы генерации голоса.',
      'nl-NL': 'Hallo, dit is een test van het stemgeneratiesysteem.',
      'pl-PL': 'Cześć, to jest test systemu generowania głosu.',
      'th-TH': 'สวัสดี นี่คือการทดสอบระบบสร้างเสียง',
      'tr-TR': 'Merhaba, bu ses oluşturma sisteminin bir testidir.',
      'vi-VN': 'Xin chào, đây là bài kiểm tra hệ thống tạo giọng nói.',
      'ro-RO': 'Salut, acesta este un test al sistemului de generare vocală.',
      'uk-UA': 'Привіт, це тест системи генерації голосу.',
      'bn-BD': 'হ্যালো, এটি ভয়েস জেনারেশন সিস্টেমের একটি পরীক্ষা।',
      'mr-IN': 'नमस्कार, हे व्हॉईस जनरेशन सिस्टमचे एक चाचणी आहे.',
      'ta-IN': 'வணக்கம், இது குரல் உருவாக்க அமைப்பின் ஒரு சோதனை.',
      'te-IN': 'హలో, ఇది వాయిస్ జనరేషన్ సిస్టమ్ యొక్క ఒక పరీక్ష.',
      'ar-SA': 'مرحبا، هذا اختبار لنظام إنتاج الصوت.',
      'ar-EG': 'اهلاً، ده اختبار لنظام إنتاج الصوت.'
    };

    const sampleText = languageSamples[formData.language || 'en-US'] || languageSamples['en-US'];
    setTestText(sampleText);
  }, [formData.language]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});

  // Test multi-speaker voice generation
  const testMultiSpeakerVoice = async () => {
    toast.error(
      'Multi-speaker voice testing is disabled (Supabase Edge Functions removed). ' +
      'We can add a new backend voice endpoint later.'
    );
    return;

    if (multiSpeakers.some(s => !s.text.trim())) {
      toast.error('Please enter text for all speakers');
      return;
    }

    setPlayingVoice('multi-speaker');

    try {
      // (Disabled) Supabase Edge Function removed
      const data: unknown = null;

      // For multi-speaker, we get a direct audio stream response
      if (data instanceof Blob) {
        // Create audio URL from blob
        const audioUrl = URL.createObjectURL(data);
        const audio = new Audio(audioUrl);
        audioElements['multi-speaker'] = audio;

        audio.onended = () => {
          setPlayingVoice(null);
          URL.revokeObjectURL(audioUrl);
          delete audioElements['multi-speaker'];
        };

        audio.onerror = () => {
          setPlayingVoice(null);
          toast.error('Failed to play multi-speaker audio');
          URL.revokeObjectURL(audioUrl);
          delete audioElements['multi-speaker'];
        };

        await audio.play();
        toast.success('Playing multi-speaker conversation');
      } else {
        toast.error('Unexpected response format for multi-speaker voice');
        setPlayingVoice(null);
      }
    } catch (error) {
      console.error('Multi-speaker voice test error:', error);
      toast.error('Failed to test multi-speaker voice');
      setPlayingVoice(null);
    }
  };

  // Fetch available voices when component mounts
  useEffect(() => {
    // Supabase Edge Functions were removed during migration.
    // Keep the form usable by allowing manual aiVoiceId entry (no remote voice list for now).
    setAvailableVoices([]);
  }, []);

  // Test voice generation (without saving)
  const testVoice = async (voiceId: string) => {
    toast.error(
      'Voice testing is disabled (Supabase Edge Functions removed). ' +
      'We can add a new backend voice endpoint later.'
    );
    return;

    if (!testText.trim()) {
      toast.error('Please enter some test text');
      return;
    }

    setPlayingVoice(voiceId);

    try {
      // Create a temporary host ID for testing (we'll use a dummy ID since we're not saving)
      const tempHostId = -1; // Temporary ID for testing

      const result = { success: false, error: 'Voice generation disabled' } as { success: boolean; audioData?: string; mimeType?: string; error?: string };

      if (result.success && result.audioData) {
        // Create WAV blob from PCM data
        const wavBlob = createWavBlob(result.audioData);
        const audioUrl = URL.createObjectURL(wavBlob);

        // Create and play audio directly
        const audio = new Audio(audioUrl);
        audioElements[voiceId] = audio;

        audio.onended = () => {
          setPlayingVoice(null);
          URL.revokeObjectURL(audioUrl);
          delete audioElements[voiceId];
        };

        audio.onerror = () => {
          setPlayingVoice(null);
          toast.error('Failed to play audio');
          URL.revokeObjectURL(audioUrl);
          delete audioElements[voiceId];
        };

        await audio.play();
        const styleText = formData.aiStyle ? ` (${formData.aiStyle} style)` : '';
        toast.success(`Playing ${voiceId} voice in ${formData.language}${styleText}`);
      } else {
        toast.error(result.error || 'Failed to generate voice');
        setPlayingVoice(null);
      }
    } catch (error) {
      console.error('Voice test error:', error);
      toast.error('Failed to test voice');
      setPlayingVoice(null);
    }
  };

  // Stop current playing audio
  const stopVoice = (voiceId: string) => {
    const audio = audioElements[voiceId];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      delete audioElements[voiceId];
    }
    setPlayingVoice(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="name">Host Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Biography</Label>
        <Textarea
          id="bio"
          value={formData.bio || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
          placeholder="Tell us about this host..."
        />
      </div>

      <div>
        <Label htmlFor="imageUrl">Profile Image URL</Label>
        <Input
          id="imageUrl"
          type="url"
          value={formData.imageUrl || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
          placeholder="https://example.com/host-image.jpg"
        />
        <p className="text-xs text-gray-500 mt-1">Enter a URL for the host's profile image</p>

        {/* Image Preview */}
        {formData.imageUrl && (
          <div className="mt-3 flex items-center space-x-3">
            <div className="relative">
              <img
                src={formData.imageUrl}
                alt="Profile preview"
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling!.classList.remove('hidden');
                }}
              />
              <div className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center hidden">
                <Mic className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <p>Image preview</p>
              <p className="text-xs text-gray-500">This is how the image will appear</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="language">Primary Language</Label>
        <Select value={formData.language || 'en-US'} onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select primary language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en-US">English (US)</SelectItem>
            <SelectItem value="en-IN">English (India)</SelectItem>
            <SelectItem value="es-US">Spanish (US)</SelectItem>
            <SelectItem value="fr-FR">French (France)</SelectItem>
            <SelectItem value="de-DE">German (Germany)</SelectItem>
            <SelectItem value="hi-IN">Hindi (India)</SelectItem>
            <SelectItem value="id-ID">Indonesian (Indonesia)</SelectItem>
            <SelectItem value="it-IT">Italian (Italy)</SelectItem>
            <SelectItem value="ja-JP">Japanese (Japan)</SelectItem>
            <SelectItem value="ko-KR">Korean (Korea)</SelectItem>
            <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
            <SelectItem value="ru-RU">Russian (Russia)</SelectItem>
            <SelectItem value="nl-NL">Dutch (Netherlands)</SelectItem>
            <SelectItem value="pl-PL">Polish (Poland)</SelectItem>
            <SelectItem value="th-TH">Thai (Thailand)</SelectItem>
            <SelectItem value="tr-TR">Turkish (Turkey)</SelectItem>
            <SelectItem value="vi-VN">Vietnamese (Vietnam)</SelectItem>
            <SelectItem value="ro-RO">Romanian (Romania)</SelectItem>
            <SelectItem value="uk-UA">Ukrainian (Ukraine)</SelectItem>
            <SelectItem value="bn-BD">Bengali (Bangladesh)</SelectItem>
            <SelectItem value="mr-IN">Marathi (India)</SelectItem>
            <SelectItem value="ta-IN">Tamil (India)</SelectItem>
            <SelectItem value="te-IN">Telugu (India)</SelectItem>
            <SelectItem value="ar-SA">Arabic (Saudi Arabia)</SelectItem>
            <SelectItem value="ar-EG">Arabic (Egyptian)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">Primary language for this host's voice generation (Gemini TTS auto-detects language from text)</p>
      </div>

      {/* AI Voice Configuration */}
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold text-lg">AI Voice Configuration</h3>

        {/* Test Text Input */}
        <div className="space-y-2">
          <Label htmlFor="testText" className="text-sm font-medium">Test Voice Text</Label>
          <Textarea
            id="testText"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Enter text to test voice generation..."
            rows={2}
            className="text-sm"
          />
          <p className="text-xs text-gray-500">Use this text to preview how each voice sounds before selecting</p>
        </div>

        {/* Available Voices Preview */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Available Gemini Voices</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border rounded-lg p-3 bg-white">
            {availableVoices.length > 0 ? (
              availableVoices.map(voice => (
                <div
                  key={voice.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    formData.aiVoiceId === voice.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{voice.name}</div>
                      <div className="text-xs text-gray-600">{voice.language} • {voice.description}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {voice.gender}
                      </Badge>
                      {formData.aiVoiceId === voice.id && (
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>

                  {/* Voice Controls */}
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (playingVoice === voice.id) {
                          stopVoice(voice.id);
                        } else {
                          testVoice(voice.id);
                        }
                      }}
                      disabled={!testText.trim()}
                      className="flex-1"
                    >
                      {playingVoice === voice.id ? (
                        <>
                          <Volume2 className="w-3 h-3 mr-1" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Test Voice
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={formData.aiVoiceId === voice.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, aiVoiceId: voice.id }))}
                    >
                      {formData.aiVoiceId === voice.id ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-gray-500">
                <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Loading available voices...</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="aiStyle">AI Style</Label>
            <Select value={formData.aiStyle || ''} onValueChange={(value) => setFormData(prev => ({ ...prev, aiStyle: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="energetic">Energetic</SelectItem>
                <SelectItem value="calm">Calm</SelectItem>
                <SelectItem value="humorous">Humorous</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="aiVoiceId">Gemini Voice</Label>
            <Select value={formData.aiVoiceId || ''} onValueChange={(value) => setFormData(prev => ({ ...prev, aiVoiceId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.map(voice => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name} ({voice.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
        />
        <Label htmlFor="isActive">Active Host</Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {host ? 'Update Host' : 'Create Host'}
        </Button>
      </div>
    </form>
  );
};

export default HostForm;