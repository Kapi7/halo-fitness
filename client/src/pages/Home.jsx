import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Activity, Users, Star, ChevronDown, Heart, Award, Clock, Instagram, MapPin, MessageCircle } from 'lucide-react';

const images = {
  hero: '/images/hila-stretch.jpg',
  about: '/images/instructor-guiding.jpg',
};

const WHATSAPP_NUMBER = '35796326140';

export default function Home() {
  const scrollToContent = () => {
    document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section with Image */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={images.hero}
            alt="Halo Fitness"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-light text-white mb-6 sm:mb-8 tracking-tight">
              Transform Your <span className="font-semibold text-halo-pink">Body & Mind</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-slate-200 font-light mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed px-4">
              From high-energy HIIT to mindful Pilates — get the body you dream of while building inner strength.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
              <Link to="/schedule">
                <Button className="w-full sm:w-auto bg-halo-pink hover:bg-halo-pink-dark text-white rounded-full px-8 sm:px-10 py-6 sm:py-8 text-base sm:text-lg uppercase tracking-widest transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(207,68,143,0.4)]">
                  Begin Your Journey
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        <motion.button
          onClick={scrollToContent}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 hover:text-white transition-colors cursor-pointer"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-8 h-8" />
        </motion.button>
      </section>

      {/* About Section */}
      <section id="about-section" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative order-2 lg:order-1"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={images.about}
                  alt="Hila - Founder of Halo Fitness"
                  className="w-full h-[400px] sm:h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
              </div>
              <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 bg-halo-pink text-white p-4 sm:p-6 rounded-2xl shadow-xl">
                <p className="text-2xl sm:text-3xl font-bold">10+</p>
                <p className="text-xs sm:text-sm uppercase tracking-wider">Years Experience</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="order-1 lg:order-2"
            >
              <span className="text-halo-pink uppercase tracking-widest text-sm font-medium">About Me</span>
              <h2 className="text-3xl sm:text-4xl font-light text-slate-900 mt-4 mb-6">
                Hi, I'm <span className="font-semibold">Hila</span>
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed text-base sm:text-lg">
                <p>
                  Movement has been part of my life from a very young age. I began my path as a ballet dancer
                  at the age of six, later completing formal dance studies and performing in a variety of styles.
                  Over time, my deep love for sport and a healthy lifestyle led me into the world of fitness and Pilates.
                </p>
                <p>
                  I am a certified fitness and Pilates instructor, specializing in HIIT, mat Pilates, apparatus Pilates,
                  barre, and rehabilitative training. My approach combines high-energy workouts that deliver real results
                  with mindful movement and deep body awareness.
                </p>
                <p>
                  I believe in working hard — pushing your limits, breaking a sweat, and earning the body you dream of.
                  But I also believe in balance. Training is a powerful tool for transformation, both physical and mental.
                  During the most challenging periods of my life, movement became my meditation and my source of resilience.
                </p>
                <p className="text-slate-700 font-medium italic">
                  Today, I share this journey with others — whether you want to sculpt your body, build strength,
                  or find your inner balance, I'm here to push you and guide you every step of the way.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 sm:gap-6 mt-8 pt-8 border-t border-slate-200">
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-halo-pink mb-1">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xl sm:text-2xl font-bold">1000+</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">Sessions Trained</p>
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-halo-pink mb-1">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xl sm:text-2xl font-bold">5</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">Certifications</p>
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-halo-pink mb-1">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-xl sm:text-2xl font-bold">15+</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">Years Experience</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* HIIT Video Section */}
      <section className="relative py-20 sm:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            poster="/images/hiit-abwheel-hq.jpg"
          >
            <source src="/videos/hiit-bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-slate-900/60" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-halo-pink uppercase tracking-widest text-sm font-medium">High Intensity</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mt-4 mb-6">
              Push Your Limits
            </h2>
            <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Burn fat. Build muscle. Get the body you've always wanted.
              Our HIIT sessions are designed to maximize results in minimum time.
            </p>
            <Link to="/schedule">
              <Button className="bg-halo-pink hover:bg-halo-pink-dark text-white rounded-full px-8 sm:px-12 py-6 text-base sm:text-lg uppercase tracking-widest transition-all transform hover:scale-105">
                Book HIIT Session
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-halo-pink uppercase tracking-widest text-sm font-medium">My Approach</span>
            <h2 className="text-3xl sm:text-4xl font-light text-slate-900 mt-4">Work Hard. Feel Amazing.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <FeatureCard
              icon={Activity}
              title="Real Results"
              description="High-energy HIIT and targeted training to sculpt your body and boost your strength."
            />
            <FeatureCard
              icon={Heart}
              title="Body & Mind"
              description="Balance intense workouts with mindful Pilates for complete transformation."
            />
            <FeatureCard
              icon={Star}
              title="Personal Attention"
              description="Small groups and private sessions ensure you're pushed to your potential."
            />
          </div>
        </div>
      </section>

      {/* Class Types Preview */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-halo-pink uppercase tracking-widest text-sm font-medium">What We Offer</span>
            <h2 className="text-3xl sm:text-4xl font-light text-slate-900 mt-4">Our Classes</h2>
            <div className="w-24 h-1 bg-halo-pink mx-auto rounded-full mt-6" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <ClassCard
              title="HIIT"
              groupPrice="25"
              privatePrice="45"
              desc="High-intensity training to burn fat, build muscle, and get the body you want."
              image="/images/hiit-group-energy.jpg"
              highlight={true}
            />
            <ClassCard
              title="Mat Pilates"
              groupPrice="25"
              desc="Core strength, flexibility, and body control through mindful movement."
              image="/images/balance-pose.jpg"
            />
            <ClassCard
              title="Reformer Pilates"
              privatePrice="50"
              desc="Deep muscle engagement and sculpting using the reformer apparatus."
              image="/images/reformer-pike-hq.jpg"
            />
            <ClassCard
              title="Rehabilitative"
              privatePrice="75"
              desc="Specialized training for recovery, injury prevention, and body restoration."
              image="/images/savasana-class.jpg"
            />
          </div>

          <div className="text-center mt-12">
            <Link to="/schedule">
              <Button className="bg-halo-pink hover:bg-halo-pink-dark text-white rounded-full px-8 sm:px-12 py-6 text-base sm:text-lg uppercase tracking-widest transition-all transform hover:scale-105">
                View Schedule & Book
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-halo-pink uppercase tracking-widest text-sm font-medium">Get in Touch</span>
              <h2 className="text-3xl sm:text-4xl font-light text-slate-900 mt-4 mb-6">Visit Halo Fitness</h2>
              <div className="space-y-4 text-slate-600">
                <p className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-halo-pink mt-1 flex-shrink-0" />
                  <span>Limassol, Cyprus</span>
                </p>
                <p className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-halo-pink mt-1 flex-shrink-0" />
                  <span>Mon - Fri: By Appointment<br />Sat - Sun: Closed</span>
                </p>
                <p className="flex items-start gap-3">
                  <Instagram className="w-5 h-5 text-halo-pink mt-1 flex-shrink-0" />
                  <a
                    href="https://www.instagram.com/halo_fitness_limassol"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-halo-pink transition-colors"
                  >
                    @halo_fitness_limassol
                  </a>
                </p>
              </div>
              <div className="mt-8">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="bg-green-500 hover:bg-green-600 text-white rounded-full px-6 py-5">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Chat on WhatsApp
                  </Button>
                </a>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="h-[300px] sm:h-[400px] rounded-2xl overflow-hidden shadow-xl"
            >
              <img
                src="/images/image.png"
                alt="Halo Fitness Training"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section with Video Background */}
      <section className="relative py-20 sm:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            poster="/images/reformer-pike-hq.jpg"
          >
            <source src="/videos/reformer-bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-slate-900/70" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-6">
              Ready to Transform?
            </h2>
            <p className="text-lg sm:text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Whether you want to burn fat, build strength, or find your inner balance —
              it starts with one session. Let's work hard together and get you the results you deserve.
            </p>
            <Link to="/schedule">
              <Button className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-8 sm:px-12 py-6 sm:py-8 text-base sm:text-lg uppercase tracking-widest transition-all transform hover:scale-105">
                Book Your First Session
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center group p-6 sm:p-8 rounded-2xl hover:bg-slate-50 transition-colors duration-500"
    >
      <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-pink-50 text-halo-pink mb-4 sm:mb-6 group-hover:bg-halo-pink group-hover:text-white transition-colors duration-500">
        <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
      </div>
      <h3 className="text-lg sm:text-xl font-medium text-slate-900 mb-2 sm:mb-3">{title}</h3>
      <p className="text-slate-500 font-light leading-relaxed text-sm sm:text-base">{description}</p>
    </motion.div>
  );
}

function ClassCard({ title, groupPrice, privatePrice, desc, image, highlight }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`bg-white rounded-xl shadow-sm border hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden group ${
        highlight ? 'border-halo-pink border-2 ring-2 ring-halo-pink/20' : 'border-slate-100'
      }`}
    >
      {image && (
        <div className="h-40 sm:h-48 overflow-hidden relative">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {highlight && (
            <div className="absolute top-3 right-3 bg-halo-pink text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Most Popular
            </div>
          )}
        </div>
      )}
      <div className="p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <div className="mb-3 sm:mb-4 space-y-1">
          {groupPrice && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase w-14">Group</span>
              <span className="text-halo-pink font-bold text-lg">{groupPrice}€</span>
            </div>
          )}
          {privatePrice && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 uppercase w-14">Private</span>
              <span className="text-halo-pink font-bold text-lg">{privatePrice}€</span>
            </div>
          )}
        </div>
        <p className="text-slate-500 text-sm">{desc}</p>
      </div>
    </motion.div>
  );
}
