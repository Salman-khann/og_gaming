'use client';
import type {Tournament,Registration} from '@/types';
import {useAuth} from './AuthProvider';
import {TournamentsView} from './TournamentsView';
import {useRouter} from 'next/navigation';
export function TournamentDetail({tournament,registrations}:{tournament:Tournament;registrations:Registration[]}){const {profile}=useAuth();const router=useRouter();return <TournamentsView detail tournaments={[tournament]} registrations={registrations} currentProfile={profile} onRegistrationCreated={()=>router.refresh()}/>;}
