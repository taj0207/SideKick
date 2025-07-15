import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { MessageCircle, Zap, Shield, Star } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">SideKick</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Your AI Assistant,
          <br />
          Always by Your Side
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Experience the power of GPT-4 with SideKick - the intelligent assistant that helps you chat, create, and solve problems with ease.
        </p>
        <div className="flex items-center justify-center space-x-4">
          <Link to="/register">
            <Button size="lg" className="px-8">
              Try Free Now
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="px-8">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose SideKick?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground">
              Get instant responses powered by GPT-4 with optimized performance for seamless conversations.
            </p>
          </div>
          <div className="text-center">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground">
              Your conversations are encrypted and private. We never store or share your personal data.
            </p>
          </div>
          <div className="text-center">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Premium Experience</h3>
            <p className="text-muted-foreground">
              Enjoy unlimited conversations, advanced features, and priority support with our Pro plan.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Simple, Transparent Pricing</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="border rounded-lg p-8 text-center">
            <h3 className="text-2xl font-semibold mb-2">Free</h3>
            <div className="text-4xl font-bold mb-4">$0</div>
            <p className="text-muted-foreground mb-6">Perfect for trying out SideKick</p>
            <ul className="space-y-2 mb-6">
              <li>✓ 10 messages per month</li>
              <li>✓ GPT-4 access</li>
              <li>✓ Basic chat interface</li>
              <li>✓ Community support</li>
            </ul>
            <Link to="/register">
              <Button variant="outline" className="w-full">
                Get Started Free
              </Button>
            </Link>
          </div>
          <div className="border rounded-lg p-8 text-center relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                Popular
              </span>
            </div>
            <h3 className="text-2xl font-semibold mb-2">Monthly Pro</h3>
            <div className="text-4xl font-bold mb-4">$99</div>
            <p className="text-muted-foreground mb-6">For power users and professionals</p>
            <ul className="space-y-2 mb-6">
              <li>✓ Unlimited messages</li>
              <li>✓ GPT-4 access</li>
              <li>✓ Priority support</li>
              <li>✓ Advanced features</li>
              <li>✓ Export conversations</li>
            </ul>
            <Link to="/register">
              <Button className="w-full">
                Start Pro Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span className="font-semibold">SideKick</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-foreground">
                Terms of Service
              </Link>
              <Link to="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
            © 2024 SideKick. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}