import Nav from '../layouts/Nav';
import Search from '../components/SearchContainer';
import Footer from '../components/Footer';
import AIAssistant from '../components/AIAssistant';
import QuickLinks from '../components/QuickLinks';
import { memo } from 'react';

const Home = memo(() => {
  return (
    <>
      <Nav />
      <Search />
      <QuickLinks />
      <AIAssistant />
      <Footer />
    </>
  );
});

Home.displayName = 'Home';
export default Home;
