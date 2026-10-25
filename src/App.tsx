import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import Home from '@/pages/Home'
import Publish from '@/pages/Publish'
import Read from '@/pages/Read'

export default function App() {
  return (
    <BrowserRouter>
      <div
        className="relative min-h-dvh overflow-x-hidden"
        style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
      >
        {/* Ambient blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div style={{ position: 'absolute', top: '6%', left: '3%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.16) 0%, transparent 70%)', filter: 'blur(70px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '4%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.14) 0%, transparent 70%)', filter: 'blur(65px)' }} />
        </div>

        <div className="relative z-10">
          <NavBar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/publish" element={<Publish />} />
              <Route path="/read/:docId" element={<Read />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
