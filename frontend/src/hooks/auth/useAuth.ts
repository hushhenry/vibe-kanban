import { useUserSystem } from '../../components/ConfigProvider';

export function useAuth() {
  const { loginStatus } = useUserSystem();

  return {
    isSignedIn: true, // loginStatus?.status === 'loggedin',
    isLoaded: true, // loginStatus !== null,
    userId:
      loginStatus?.status === 'loggedin' ? loginStatus.profile.user_id : 'dummy-user',
  };
}
