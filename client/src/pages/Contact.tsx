import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Target, Building2, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "36704066713";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export default function Contact() {
  const [activeTab, setActiveTab] = useState("contact");

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
        <div className="max-w-5xl w-full glass-card p-7 md:p-10">
          <header className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
              <span>Contact</span>
              <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
            </div>

            <h1 className="font-gp-display font-bold leading-[1.15] tracking-[-0.01em] text-[clamp(2rem,4vw,3rem)] text-white">
              Get in touch with <span className="text-white italic">Golden Pearl</span>
            </h1>
            <p className="mt-4 mx-auto max-w-xl font-gp-serif text-[1.1rem] italic tracking-[0.04em] text-white/85">
              We’re happy to help. Reach us via WhatsApp or explore our audience overview.
            </p>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
            <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto h-auto p-2 bg-white/10 border border-white/25 rounded-2xl gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)]" style={{ backdropFilter: "blur(28px) saturate(180%)" }}>
              <TabsTrigger
                value="contact"
                className="rounded-xl data-[state=active]:bg-white/25 data-[state=active]:border data-[state=active]:border-white/30 data-[state=active]:text-white text-white/90 hover:text-white hover:bg-white/10 transition-all font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] py-3"
              >
                <MessageCircle className="h-4 w-4 mr-2 inline" />
                Contact
              </TabsTrigger>
              <TabsTrigger
                value="audience"
                className="rounded-xl data-[state=active]:bg-white/25 data-[state=active]:border data-[state=active]:border-white/30 data-[state=active]:text-white text-white/90 hover:text-white hover:bg-white/10 transition-all font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] py-3"
              >
                <Users className="h-4 w-4 mr-2 inline" />
                Audience
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="space-y-8">
              <div className="max-w-md mx-auto text-center">
                <p className="font-gp-serif text-[1.05rem] italic text-white/90 mb-8">
                  Reach us on WhatsApp
                </p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-gp-sans font-semibold text-[0.85rem] uppercase tracking-[0.12em] border border-white/25 transition-colors shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
                >
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Message us: +36 70 406 6713
                </a>
              </div>
            </TabsContent>

            <TabsContent value="audience" className="space-y-10">
              <div className="text-center mb-10">
                <h2 className="font-gp-display text-2xl md:text-3xl font-semibold text-white mb-2">Our Audience</h2>
                <p className="font-gp-serif text-[1.05rem] italic text-white/85 max-w-2xl mx-auto">
                  Connect with our diverse, engaged community.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="glass-card text-center hover:border-white/35 transition-colors !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardContent className="pt-8 pb-8">
                    <div className="inline-flex items-center justify-center p-4 border border-white/25 rounded-full mb-4 text-white/90">
                      <Users className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-gp-brand font-semibold text-white mb-1 tracking-[0.04em]">25,000+</div>
                    <div className="text-[color:var(--gp-white)]/90 font-gp-sans text-[0.75rem] uppercase tracking-[0.12em]">Daily Listeners</div>
                  </CardContent>
                </Card>
                <Card className="glass-card text-center hover:border-white/35 transition-colors !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardContent className="pt-8 pb-8">
                    <div className="inline-flex items-center justify-center p-4 border border-white/25 rounded-full mb-4 text-white/90">
                      <Clock className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-gp-brand font-semibold text-white mb-1 tracking-[0.04em]">6.5 hours</div>
                    <div className="text-[color:var(--gp-white)]/90 font-gp-sans text-[0.75rem] uppercase tracking-[0.12em]">Average Listen Time</div>
                  </CardContent>
                </Card>
                <Card className="glass-card text-center hover:border-white/35 transition-colors !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardContent className="pt-8 pb-8">
                    <div className="inline-flex items-center justify-center p-4 border border-white/25 rounded-full mb-4 text-white/90">
                      <Target className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-gp-brand font-semibold text-white mb-1 tracking-[0.04em]">25-45</div>
                    <div className="text-[color:var(--gp-white)]/90 font-gp-sans text-[0.75rem] uppercase tracking-[0.12em]">Primary Age Range</div>
                  </CardContent>
                </Card>
                <Card className="glass-card text-center hover:border-white/35 transition-colors !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardContent className="pt-8 pb-8">
                    <div className="inline-flex items-center justify-center p-4 border border-white/25 rounded-full mb-4 text-white/90">
                      <Building2 className="h-8 w-8" />
                    </div>
                    <div className="text-3xl font-gp-brand font-semibold text-white mb-1 tracking-[0.04em]">65%</div>
                    <div className="text-[color:var(--gp-white)]/90 font-gp-sans text-[0.75rem] uppercase tracking-[0.12em]">Professional/Business</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardHeader>
                    <CardTitle className="text-lg font-gp-display font-semibold text-white flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-white/90" />
                      Peak Listening Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white/10 rounded-2xl border border-white/20">
                      <span className="font-medium text-[color:var(--gp-white)] text-sm font-gp-sans">Morning Drive (7-10 AM)</span>
                      <Badge className="bg-white/25 border border-white/30 text-white text-xs">Highest</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/10 rounded-2xl border border-white/20">
                      <span className="font-medium text-[color:var(--gp-white)] text-sm font-gp-sans">Lunch Hour (12-2 PM)</span>
                      <Badge variant="outline" className="border-white/35 text-white text-xs">Strong</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/10 rounded-2xl border border-white/20">
                      <span className="font-medium text-[color:var(--gp-white)] text-sm font-gp-sans">Evening Commute (5-7 PM)</span>
                      <Badge className="bg-white/25 border border-white/30 text-white text-xs">Premium</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardHeader>
                    <CardTitle className="text-lg font-gp-display font-semibold text-white flex items-center">
                      <Target className="h-5 w-5 mr-2 text-white/90" />
                      Audience Interests
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Business & Finance",
                        "Entertainment",
                        "Cultural Events",
                        "Technology",
                        "Dining & Lifestyle",
                        "Travel & Tourism",
                        "Real Estate",
                        "Health & Wellness",
                      ].map((interest, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="px-3 py-1 text-xs font-medium border-white/25 text-white/90 bg-white/10 rounded-2xl"
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
