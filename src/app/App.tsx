import { initSurvicate } from '../public-path';
import { lazy, Suspense } from 'react';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import ChunkLoader from '@/components/loader/chunk-loader';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { crypto_currencies_display_order, fiat_currencies_display_order } from '@/components/shared';
import { useOfflineDetection } from '@/hooks/useOfflineDetection';
import { StoreProvider } from '@/hooks/useStore';
import CallbackPage from '@/pages/callback';
import Endpoint from '@/pages/endpoint';
import { TAuthData } from '@/types/api-types';
import { initializeI18n, localize, TranslationProvider } from '@deriv-com/translations';
import CoreStoreProvider from './CoreStoreProvider';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));

const { TRANSLATIONS_CDN_URL, R2_PROJECT_NAME, CROWDIN_BRANCH_NAME } = process.env;
const i18nInstance = initializeI18n({
    cdnUrl: `${TRANSLATIONS_CDN_URL}/${R2_PROJECT_NAME}/${CROWDIN_BRANCH_NAME}`,
});

// Simple Suspense wrapper without timeout that causes dark landing page
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => {
    const { isOnline } = useOfflineDetection();

    const getLoadingMessage = () => {
        if (!isOnline) return localize('Loading offline dashboard...');
        return localize('Please wait while we connect to the server...');
    };

    return <Suspense fallback={<ChunkLoader message={getLoadingMessage()} />}>{children}</Suspense>;
};

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route
            path='/'
            element={
                <SuspenseWrapper>
                    <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
                        <StoreProvider>
                            <RoutePromptDialog />
                            <CoreStoreProvider>
                                <Layout />
                            </CoreStoreProvider>
                        </StoreProvider>
                    </TranslationProvider>
                </SuspenseWrapper>
            }
        >
            {/* All child routes will be passed as children to Layout */}
            <Route index element={<AppRoot />} />
            <Route path='endpoint' element={<Endpoint />} />
            <Route path='callback' element={<CallbackPage />} />
        </Route>
    )
);

function App() {
    React.useEffect(() => {
        // Use the invalid token handler hook to automatically retrigger OIDC authentication
        // when an invalid token is detected and the cookie logged state is true

        initSurvicate();
        window?.dataLayer?.push({ event: 'page_load' });
        return () => {
            // Clean up the invalid token handler when the component unmounts
            const survicate_box = document.getElementById('survicate-box');
            if (survicate_box) {
                survicate_box.style.display = 'none';
            }
        };
    }, []);

        React.useEffect(() => {
        const loadBotAuth = async () => {
            try {
                const response = await fetch('/api/bot-auth');

                if (!response.ok) {
                    console.warn('Bot authentication failed');
                    return;
                }

                const tokens = await response.json();

                const accountsList: Record<string, string> = {};
                const clientAccounts: Record<
                    string,
                    { loginid: string; token: string; currency: string }
                > = {};

                for (let i = 1; i <= 3; i++) {
                    const loginid = tokens[`acct${i}`];
                    const token = tokens[`token${i}`];
                    const currency = tokens[`cur${i}`] || '';

                    if (loginid && token) {
                        accountsList[loginid] = token;

                        clientAccounts[loginid] = {
                            loginid,
                            token,
                            currency,
                        };
                    }
                }

                localStorage.setItem(
                    'accountsList',
                    JSON.stringify(accountsList)
                );

                localStorage.setItem(
                    'clientAccounts',
                    JSON.stringify(clientAccounts)
                );

                const accountCurrency =
                    new URLSearchParams(window.location.search)
                        .get('account')
                        ?.toUpperCase();

                let selectedAccount:
                    | {
                          loginid: string;
                          token: string;
                          currency: string;
                      }
                    | undefined;

                if (accountCurrency === 'DEMO') {
                    selectedAccount = Object.values(clientAccounts).find(
                        account => account.loginid.startsWith('VR')
                    );
                } else if (accountCurrency) {
                    selectedAccount = Object.values(clientAccounts).find(
                        account =>
                            !account.loginid.startsWith('VR') &&
                            account.currency.toUpperCase() === accountCurrency
                    );
                }

                if (!selectedAccount) {
                    selectedAccount = Object.values(clientAccounts)[0];
                }

                if (selectedAccount) {
                    localStorage.setItem(
                        'authToken',
                        selectedAccount.token
                    );

                    localStorage.setItem(
                        'active_loginid',
                        selectedAccount.loginid
                    );
                }
            } catch (error) {
                console.warn(
                    'Bot authentication error',
                    error
                );
            }
        };

        loadBotAuth();
    }, []);

    return <RouterProvider router={router} />;
}

export default App;
