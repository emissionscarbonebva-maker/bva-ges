/* ===== STATE alignée sur Méthodologie ===== */
const sidebar   = document.getElementById("sidebar");
const toggle    = document.getElementById("toggleSidebar");
const hamburger = document.getElementById("hamburger");
const backdrop  = document.getElementById("backdrop");

/* ---- Desktop : applique l'état collapsed sur <body> (marge .main) ---- */
function syncBodyCollapsedClass() {
  const isDesktop   = window.matchMedia("(min-width: 992px)").matches;
  const isCollapsed = sidebar?.classList.contains("collapsed");
  if (isDesktop) {
    document.body.classList.toggle("sidebar-collapsed", !!isCollapsed);
  } else {
    document.body.classList.remove("sidebar-collapsed");
  }
}

/* ===== SIDEBAR COLLAPSE (DESKTOP) ===== */
if (window.matchMedia("(min-width: 992px)").matches) {
  try{
    if (localStorage.getItem("sidebarCollapsed") === "true"){
      sidebar?.classList.add("collapsed");
    }
  }catch(e){}
  syncBodyCollapsedClass();
}

if (toggle){
  toggle.addEventListener("click", function(){
    sidebar?.classList.toggle("collapsed");
    try{
      localStorage.setItem("sidebarCollapsed",
        sidebar?.classList.contains("collapsed")
      );
    }catch(e){}
    syncBodyCollapsedClass();
  });
}

/* Recalcule lors d’un resize (passage mobile<->desktop) */
window.addEventListener("resize", syncBodyCollapsedClass);

/* ===== OFF-CANVAS (MOBILE/TABLET) ===== */
function openSidebarMobile() {
  sidebar?.classList.add("open");
  if (backdrop){
    backdrop.style.visibility = "visible";
    backdrop.style.opacity = "1";
  }
  if (hamburger){
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "Fermer le menu");
  }
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}
function closeSidebarMobile() {
  sidebar?.classList.remove("open");
  if (backdrop){
    backdrop.style.opacity = "0";
    backdrop.style.visibility = "hidden";
  }
  if (hamburger){
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "Ouvrir le menu");
  }
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

if (hamburger){
  hamburger.addEventListener("click", () => {
    if (sidebar?.classList.contains("open")){
      closeSidebarMobile();
    } else {
      openSidebarMobile();
    }
  });
}
if (backdrop){
  backdrop.addEventListener("click", closeSidebarMobile);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape"){ closeSidebarMobile(); }
});

/* Fermer menu mobile quand on clique un lien */
document.querySelectorAll(".menu a").forEach(a => {
  a.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 991.98px)").matches) {
      closeSidebarMobile();
    }
  });
});

/* ===== MENU ACTIF AUTOMATIQUE ===== */
let currentPage = window.location.pathname.split("/").pop();
if(currentPage === "") currentPage = "index.html";
document.querySelectorAll(".menu a").forEach(link => {
  const linkPage = link.getAttribute("href");
  if(linkPage === currentPage){
    link.classList.add("active");
  }
});

/* (on conserve les listeners d'alignement de hauteur) */
window.addEventListener('load', matchContainerSizeOnce);
window.addEventListener('resize', () => {
  clearTimeout(window.__matchKPITimer);
  window.__matchKPITimer = setTimeout(matchContainerSizeOnce, 120);
});
