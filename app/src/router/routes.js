const routes = [
  {
    path: '/login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('../pages/IndexPage.vue') },
      { path: 'organizations', component: () => import('../pages/OrganizationsPage.vue') },
      { path: 'departments', component: () => import('../pages/DepartmentsPage.vue') },
      { path: 'positions', component: () => import('../pages/PositionsPage.vue') },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    redirect: '/',
  },
];

export default routes;