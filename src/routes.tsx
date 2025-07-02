import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import NotFound from './pages/NotFound';
import Simple from './pages/Simple';
import HomePage from './pages/HomePage';
// import HomePageDeep from './pages/HomePageDeep';
const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/simple" element={<Simple />} />
        <Route path="/antd-x" element={<HomePage />} />
        {/* <Route path="/deepseek" element={<HomePageDeep />} /> */}
      </Routes>
    </Router>
  );
};

export default AppRoutes;
  