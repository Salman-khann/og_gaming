import {Navbar} from '@/components/Navbar';
import {PlayersWorkspace} from '@/components/PlayersWorkspace';
import {Suspense} from 'react';
export default function PlayersPage(){return <><Navbar/><Suspense fallback={<main className="wrap arena-main"><p role="status">Loading players...</p></main>}><PlayersWorkspace/></Suspense></>;}
