document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('lang').addEventListener('click',()=>{document.body.classList.toggle('english');document.documentElement.lang=document.body.classList.contains('english')?'en':'zh-CN'});
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.08});
document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));
