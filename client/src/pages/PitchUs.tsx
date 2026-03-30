import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { 
  Handshake, 
  Radio, 
  Users, 
  Calendar, 
  DollarSign, 
  Megaphone, 
  Star, 
  Clock,
  Mail,
  Phone,
  Building2,
  Target,
  TrendingUp,
  CheckCircle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function PitchUs() {
  const [activeTab, setActiveTab] = useState("packages");
  const contactFormRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    message: ''
  });

  const scrollToContact = () => {
    setActiveTab("contact");
    setTimeout(() => {
      contactFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from('partnership_pitches')
        .insert({
          companyName: formData.companyName,
          contactName: formData.contactName,
          emailAddress: formData.email,
          phoneNumber: formData.phone,
          additionalMessage: formData.message,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to submit partnership pitch');
      }

      const result = data;

      toast({
        title: "Pitch Submitted Successfully!",
        description: "Our partnership team will review your proposal and get back to you within 48 hours.",
      });

      // Reset form
      setFormData({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        message: ''
      });
    } catch (error) {
      console.error('Error submitting partnership pitch:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const partnershipPackages = [
    {
      name: "Event Promotion",
      price: "Starting at 2,500 AED",
      features: [
        "Live on-air mentions during peak hours",
        "AI-generated promotional dialogue",
        "Social media cross-promotion",
        "Event listing in our Shop section",
        "Listener discount codes"
      ],
      icon: <Calendar className="h-6 w-6" />,
      color: "bg-blue-50 border-blue-200"
    },
    {
      name: "Product Placement",
      price: "Starting at 1,800 AED/month",
      features: [
        "Featured product spots in Shop",
        "Integration into morning show discussions",
        "Affiliate tracking and analytics",
        "Custom promotional scripts",
        "Monthly performance reports"
      ],
      icon: <Target className="h-6 w-6" />,
      color: "bg-radio-cyan/10 border-radio-cyan/30"
    },
    {
      name: "Sponsored Content",
      price: "Starting at 4,000 AED",
      features: [
        "Dedicated program segments",
        "Professional content creation",
        "Multi-platform distribution",
        "Expert host interviews",
        "Brand storytelling integration"
      ],
      icon: <Megaphone className="h-6 w-6" />,
      color: "bg-purple-50 border-purple-200"
    },
    {
      name: "Partnership Program",
      price: "Custom pricing",
      features: [
        "Long-term brand association",
        "Co-branded content creation",
        "Exclusive promotional rights",
        "Priority event coverage",
        "Strategic marketing consultation"
      ],
      icon: <Handshake className="h-6 w-6" />,
      color: "bg-radio-cyan/10 dark:bg-radio-cyan/20 border-radio-cyan/30 dark:border-radio-cyan/20"
    }
  ];

  const successStories = [
    {
      company: "Dubai Marina Events",
      result: "300% increase in ticket sales",
      description: "Our promotional coverage of their summer concert series resulted in sold-out shows and extended dates."
    },
    {
      company: "Local Art Gallery",
      result: "150+ new monthly visitors",
      description: "Featured interviews and event promotion drove significant foot traffic to their exhibitions."
    },
    {
      company: "Tech Startup",
      result: "50 new B2B leads",
      description: "Sponsored segments during business hours connected them with potential enterprise clients."
    }
  ];

  return (
    <AuroraBackground animationSpeed={60} showRadialGradient={true}>
      <div className="relative z-10 flex items-center justify-center px-4 pt-12 md:pt-16 min-h-screen pb-12">
        <div className="max-w-7xl w-full">
          {/* Enhanced Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 flex-wrap">
              <div className="bg-radio-cyan/10 dark:bg-radio-cyan/20 p-2 md:p-3 rounded-2xl">
                <Handshake className="h-8 w-8 md:h-10 md:w-10 text-radio-cyan dark:text-radio-cyan/100" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-poppins font-semibold text-radio-cyan dark:text-radio-cyan/100">
                Contact us Your Collaboration
              </h1>
            </div>
            <p className="text-lg font-poppins font-light text-gray-700 dark:text-neutral-300 max-w-4xl mx-auto leading-relaxed mb-6">
              Partner with Golden Pearl Radio Dubai to amplify your brand, promote your events, 
              and connect with our engaged community across the Emirates. Let's create something extraordinary together.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Badge variant="secondary" className="px-4 py-2 text-sm bg-radio-cyan/10 dark:bg-radio-cyan/20 text-radio-cyan dark:text-radio-cyan/90 border-radio-cyan/30 dark:border-radio-cyan/20">
                <Star className="h-4 w-4 mr-2" />
                25,000+ Daily Listeners
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-sm bg-radio-cyan/10 dark:bg-radio-cyan/20 text-radio-cyan dark:text-radio-cyan/90 border-radio-cyan/30 dark:border-radio-cyan/20">
                <Target className="h-4 w-4 mr-2" />
                Dubai's #1 Radio Station
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-sm bg-radio-cyan/10 dark:bg-radio-cyan/20 text-radio-cyan dark:text-radio-cyan/90 border-radio-cyan/30 dark:border-radio-cyan/20">
                <TrendingUp className="h-4 w-4 mr-2" />
                Proven Results
              </Badge>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full max-w-4xl mx-auto h-auto md:h-auto p-2 md:p-1.5 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 gap-2 md:gap-1">
              <TabsTrigger 
                value="packages" 
                className="rounded-lg data-[state=active]:bg-radio-cyan/10 dark:data-[state=active]:bg-radio-cyan/20 data-[state=active]:text-radio-cyan dark:data-[state=active]:text-radio-cyan/100 transition-all duration-200 font-medium text-xs sm:text-sm py-2.5 md:py-3 px-3 md:px-4"
              >
                <DollarSign className="h-4 w-4 sm:h-4 sm:w-4 mr-2 md:mr-2 inline" />
                <span className="hidden sm:inline">Packages</span>
                <span className="sm:hidden">Pack</span>
              </TabsTrigger>
              <TabsTrigger 
                value="success" 
                className="rounded-lg data-[state=active]:bg-radio-cyan/10 dark:data-[state=active]:bg-radio-cyan/20 data-[state=active]:text-radio-cyan dark:data-[state=active]:text-radio-cyan/100 transition-all duration-200 font-medium text-xs sm:text-sm py-2.5 md:py-3 px-3 md:px-4"
              >
                <Star className="h-4 w-4 sm:h-4 sm:w-4 mr-2 md:mr-2 inline" />
                <span className="hidden sm:inline">Success Stories</span>
                <span className="sm:hidden">Success</span>
              </TabsTrigger>
              <TabsTrigger 
                value="audience" 
                className="rounded-lg data-[state=active]:bg-radio-cyan/10 dark:data-[state=active]:bg-radio-cyan/20 data-[state=active]:text-radio-cyan dark:data-[state=active]:text-radio-cyan/100 transition-all duration-200 font-medium text-xs sm:text-sm py-2.5 md:py-3 px-3 md:px-4"
              >
                <Users className="h-4 w-4 sm:h-4 sm:w-4 mr-2 md:mr-2 inline" />
                <span className="hidden sm:inline">Our Audience</span>
                <span className="sm:hidden">Audience</span>
              </TabsTrigger>
              <TabsTrigger 
                value="contact" 
                className="rounded-lg data-[state=active]:bg-radio-cyan/10 dark:data-[state=active]:bg-radio-cyan/20 data-[state=active]:text-radio-cyan dark:data-[state=active]:text-radio-cyan/100 transition-all duration-200 font-medium text-xs sm:text-sm py-2.5 md:py-3 px-3 md:px-4"
              >
                <Mail className="h-4 w-4 sm:h-4 sm:w-4 mr-2 md:mr-2 inline" />
                <span className="hidden sm:inline">Contact Us</span>
                <span className="sm:hidden">Contact</span>
              </TabsTrigger>
            </TabsList>

          <TabsContent value="packages" className="space-y-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 mb-4">Partnership Packages</h2>
              <p className="text-lg text-gray-600 dark:text-neutral-400 max-w-3xl mx-auto font-poppins font-light">
                Choose from our flexible partnership options designed to maximize your reach and ROI.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {partnershipPackages.map((pkg, index) => (
                <Card key={index} className="group transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 bg-white dark:bg-neutral-900 rounded-2xl hover:shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-radio-cyan/10 dark:bg-radio-cyan/20 group-hover:bg-radio-cyan/15 dark:group-hover:bg-radio-cyan/20 transition-all duration-300">
                        <div className="text-radio-cyan dark:text-radio-cyan/100">{pkg.icon}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-poppins font-bold text-radio-cyan dark:text-radio-cyan/100">{pkg.price}</div>
                      </div>
                    </div>
                    <CardTitle className="text-xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 group-hover:text-radio-cyan dark:group-hover:text-radio-cyan/100 transition-colors duration-300">
                      {pkg.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-3 mb-6">
                      {pkg.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start space-x-3">
                          <CheckCircle className="h-5 w-5 text-radio-cyan/100 dark:text-radio-cyan/90 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-neutral-300 leading-relaxed font-poppins font-light">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      onClick={scrollToContact}
                      className="w-full bg-radio-cyan hover:bg-radio-deep-blue dark:bg-radio-cyan dark:hover:bg-radio-deep-blue text-white font-semibold py-4 text-base rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      Learn More
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="success" className="space-y-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 mb-4">Partnership Success Stories</h2>
              <p className="text-lg text-gray-600 dark:text-neutral-400 max-w-3xl mx-auto font-poppins font-light">
                See how our collaboration partners achieved remarkable results through Golden Pearl Radio.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {successStories.map((story, index) => (
                <Card key={index} className="group transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 bg-white dark:bg-neutral-900 rounded-2xl hover:shadow-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2 rounded-lg bg-radio-cyan/10 dark:bg-radio-cyan/20">
                        <Star className="h-6 w-6 text-radio-cyan/100 dark:text-radio-cyan/90 fill-current" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-poppins font-semibold text-gray-900 dark:text-neutral-100 group-hover:text-radio-cyan dark:group-hover:text-radio-cyan/100 transition-colors duration-300">
                          {story.company}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="text-3xl font-poppins font-bold text-radio-cyan dark:text-radio-cyan/100 mb-2">{story.result}</div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-700 dark:text-neutral-300 leading-relaxed font-poppins font-light">{story.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card className="bg-radio-cyan/10/50 dark:bg-radio-cyan/15 border-2 border-radio-cyan/30 dark:border-radio-cyan/20 rounded-2xl">
              <CardContent className="pt-8 pb-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center p-4 bg-white dark:bg-neutral-900 rounded-full mb-6">
                    <TrendingUp className="h-12 w-12 text-radio-cyan dark:text-radio-cyan/100" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 mb-4">
                    Ready to Be Our Next Success Story?
                  </h3>
                  <p className="text-lg text-gray-700 dark:text-neutral-300 max-w-3xl mx-auto leading-relaxed mb-6 font-poppins font-light">
                    Join our growing list of successful partners and see measurable results 
                    from radio promotion that reaches the heart of Dubai's community.
                  </p>
                  <Button 
                    size="lg" 
                    onClick={scrollToContact}
                    className="bg-radio-cyan hover:bg-radio-deep-blue dark:bg-radio-cyan dark:hover:bg-radio-deep-blue text-white font-semibold px-8 py-4 text-base rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Start Your Partnership Journey
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audience" className="space-y-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 mb-4">Our Audience</h2>
              <p className="text-lg text-gray-600 dark:text-neutral-400 max-w-3xl mx-auto font-poppins font-light">
                Connect with Dubai's diverse, engaged community through our platform.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <Card className="text-center transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 bg-white dark:bg-neutral-900 rounded-2xl hover:shadow-xl">
                <CardContent className="pt-8 pb-8">
                  <div className="inline-flex items-center justify-center p-4 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-full mb-6">
                    <Users className="h-8 w-8 text-radio-cyan dark:text-radio-cyan/100" />
                  </div>
                  <div className="text-4xl font-poppins font-bold text-gray-900 dark:text-neutral-100 mb-2">25,000+</div>
                  <div className="text-gray-600 dark:text-neutral-400 font-medium font-poppins">Daily Listeners</div>
                </CardContent>
              </Card>
              
              <Card className="text-center transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 bg-white dark:bg-neutral-900 rounded-2xl hover:shadow-xl">
                <CardContent className="pt-8 pb-8">
                  <div className="inline-flex items-center justify-center p-4 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-full mb-6">
                    <Clock className="h-8 w-8 text-radio-cyan dark:text-radio-cyan/100" />
                  </div>
                  <div className="text-4xl font-poppins font-bold text-gray-900 dark:text-neutral-100 mb-2">6.5 hours</div>
                  <div className="text-gray-600 dark:text-neutral-400 font-medium font-poppins">Average Listen Time</div>
                </CardContent>
              </Card>
              
              <Card className="text-center transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 bg-white dark:bg-neutral-900 rounded-2xl hover:shadow-xl">
                <CardContent className="pt-8 pb-8">
                  <div className="inline-flex items-center justify-center p-4 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-full mb-6">
                    <Target className="h-8 w-8 text-radio-cyan dark:text-radio-cyan/100" />
                  </div>
                  <div className="text-4xl font-poppins font-bold text-gray-900 dark:text-neutral-100 mb-2">25-45</div>
                  <div className="text-gray-600 dark:text-neutral-400 font-medium font-poppins">Primary Age Range</div>
                </CardContent>
              </Card>
              
              <Card className="text-center transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 bg-white dark:bg-neutral-900 rounded-2xl hover:shadow-xl">
                <CardContent className="pt-8 pb-8">
                  <div className="inline-flex items-center justify-center p-4 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-full mb-6">
                    <Building2 className="h-8 w-8 text-radio-cyan dark:text-radio-cyan/100" />
                  </div>
                  <div className="text-4xl font-poppins font-bold text-gray-900 dark:text-neutral-100 mb-2">65%</div>
                  <div className="text-gray-600 dark:text-neutral-400 font-medium font-poppins">Professional/Business</div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 flex items-center">
                    <Clock className="h-6 w-6 mr-3 text-radio-cyan dark:text-radio-cyan/100" />
                    Peak Listening Hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-lg border border-radio-cyan/30 dark:border-radio-cyan/20">
                    <span className="font-semibold text-gray-900 dark:text-neutral-100 font-poppins">Morning Drive (7-10 AM)</span>
                    <Badge className="bg-radio-cyan hover:bg-radio-deep-blue text-white">Highest Engagement</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-radio-cyan/10/50 dark:bg-radio-cyan/15 rounded-lg border border-radio-cyan/30/50 dark:border-radio-cyan-900/30">
                    <span className="font-semibold text-gray-900 dark:text-neutral-100 font-poppins">Lunch Hour (12-2 PM)</span>
                    <Badge variant="outline" className="border-radio-cyan/50 dark:border-radio-cyan/40 text-radio-cyan dark:text-radio-cyan/90">Strong Reach</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-lg border border-radio-cyan/30 dark:border-radio-cyan/20">
                    <span className="font-semibold text-gray-900 dark:text-neutral-100 font-poppins">Evening Commute (5-7 PM)</span>
                    <Badge className="bg-radio-cyan hover:bg-radio-deep-blue text-white">Premium Slots</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="transition-all duration-300 border-2 border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 flex items-center">
                    <Target className="h-6 w-6 mr-3 text-radio-cyan dark:text-radio-cyan/100" />
                    Audience Interests
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-3">
                    {[
                      "Business & Finance",
                      "Entertainment", 
                      "Cultural Events",
                      "Technology",
                      "Dining & Lifestyle",
                      "Travel & Tourism",
                      "Real Estate",
                      "Health & Wellness"
                    ].map((interest, index) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="px-4 py-2 text-sm font-medium border-gray-300 dark:border-neutral-700 hover:border-radio-cyan/100 dark:hover:border-radio-cyan/100 hover:text-radio-cyan dark:hover:text-radio-cyan/90 transition-colors duration-200 cursor-default"
                      >
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-12">
            <div ref={contactFormRef} className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center p-4 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-full mb-6">
                  <Mail className="h-8 w-8 text-radio-cyan dark:text-radio-cyan/100" />
                </div>
                <h2 className="text-3xl md:text-4xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 mb-4">Contact Us</h2>
                <p className="text-lg text-gray-600 dark:text-neutral-400 font-poppins font-light">
                  Get in touch with us and we'll get back to you within 48 hours.
                </p>
              </div>
              
              <Card className="border-2 border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl">
                <CardContent className="pt-8 pb-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="companyName" className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                          Company Name *
                        </Label>
                        <Input
                          id="companyName"
                          value={formData.companyName}
                          onChange={(e) => handleInputChange('companyName', e.target.value)}
                          required
                          className="h-12 border-gray-300 dark:border-neutral-700 focus:border-radio-cyan/100 dark:focus:border-radio-cyan/100 focus:ring-radio-cyan/100/20"
                          placeholder="Your company name"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="contactName" className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                          Contact Name *
                        </Label>
                        <Input
                          id="contactName"
                          value={formData.contactName}
                          onChange={(e) => handleInputChange('contactName', e.target.value)}
                          required
                          className="h-12 border-gray-300 dark:border-neutral-700 focus:border-radio-cyan/100 dark:focus:border-radio-cyan/100 focus:ring-radio-cyan/100/20"
                          placeholder="Your full name"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                          Email Address *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                          className="h-12 border-gray-300 dark:border-neutral-700 focus:border-radio-cyan/100 dark:focus:border-radio-cyan/100 focus:ring-radio-cyan/100/20"
                          placeholder="your.email@company.com"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="phone" className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="h-12 border-gray-300 dark:border-neutral-700 focus:border-radio-cyan/100 dark:focus:border-radio-cyan/100 focus:ring-radio-cyan/100/20"
                          placeholder="+971 XX XXX XXXX"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Label htmlFor="message" className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                        Message *
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Tell us about your collaboration idea, partnership interest, or any questions..."
                        value={formData.message}
                        onChange={(e) => handleInputChange('message', e.target.value)}
                        required
                        className="min-h-32 border-gray-300 dark:border-neutral-700 focus:border-radio-cyan/100 dark:focus:border-radio-cyan/100 focus:ring-radio-cyan/100/20 resize-none"
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-radio-cyan hover:bg-radio-deep-blue dark:bg-radio-cyan dark:hover:bg-radio-deep-blue text-white font-semibold py-5 text-lg rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                      size="lg"
                    >
                      <Mail className="h-5 w-5 mr-3" />
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

          {/* Enhanced Contact Information */}
          <Card className="mt-16 bg-radio-cyan/10/50 dark:bg-radio-cyan/15 border-2 border-radio-cyan/30 dark:border-radio-cyan/20 rounded-2xl">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="inline-flex items-center justify-center p-4 bg-white dark:bg-neutral-900 rounded-full mb-8">
                  <Handshake className="h-10 w-10 text-radio-cyan dark:text-radio-cyan/100" />
                </div>
                <h3 className="text-2xl md:text-3xl font-poppins font-semibold text-gray-900 dark:text-neutral-100 mb-6">
                  Ready to Start Your Partnership Journey?
                </h3>
                <div className="flex flex-col md:flex-row justify-center items-center space-y-6 md:space-y-0 md:space-x-12 mb-8">
                  <div className="flex items-center space-x-4 bg-white dark:bg-neutral-900 px-6 py-4 rounded-xl border-2 border-radio-cyan/30 dark:border-radio-cyan/20 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 transition-colors">
                    <div className="p-3 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-full">
                      <Mail className="h-6 w-6 text-radio-cyan dark:text-radio-cyan/100" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-gray-600 dark:text-neutral-400 font-medium font-poppins">Email Us</div>
                      <div className="text-gray-900 dark:text-neutral-100 font-semibold font-poppins">partnerships@goldenpearl.radio</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 bg-white dark:bg-neutral-900 px-6 py-4 rounded-xl border-2 border-radio-cyan/30 dark:border-radio-cyan/20 hover:border-radio-cyan/50 dark:hover:border-radio-cyan/40 transition-colors">
                    <div className="p-3 bg-radio-cyan/10 dark:bg-radio-cyan/20 rounded-full">
                      <Phone className="h-6 w-6 text-radio-cyan dark:text-radio-cyan/100" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-gray-600 dark:text-neutral-400 font-medium font-poppins">Call Us</div>
                      <div className="text-gray-900 dark:text-neutral-100 font-semibold font-poppins">+971-4-XXX-XXXX</div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 dark:text-neutral-300 max-w-2xl mx-auto leading-relaxed font-poppins font-light">
                  Our partnership team is excited to explore collaboration opportunities with you. 
                  We typically respond within 48 hours with a detailed proposal tailored to your needs.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
                  <Button 
                    size="lg"
                    onClick={scrollToContact}
                    className="bg-radio-cyan hover:bg-radio-deep-blue dark:bg-radio-cyan dark:hover:bg-radio-deep-blue text-white font-semibold px-8 py-4 text-base rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <Mail className="h-5 w-5 mr-2" />
                    Contact Us
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuroraBackground>
  );
}