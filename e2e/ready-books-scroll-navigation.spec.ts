import {test,expect} from './fixtures';
import type {Locator,Page} from '@playwright/test';
import {preacceptCookies} from './helpers/navigation';

async function isPainted(locator:Locator){
  return locator.evaluate(element=>{
    const rect=element.getBoundingClientRect();
    if(rect.width<2||rect.height<2||rect.left<0||rect.top<0||rect.right>innerWidth||rect.bottom>innerHeight)return false;
    return [[rect.left+1,rect.top+1],[rect.right-1,rect.bottom-1],[rect.left+rect.width/2,rect.top+rect.height/2]].every(([x,y])=>{
      const painted=document.elementFromPoint(x,y);
      return !!painted&&(painted===element||element.contains(painted));
    });
  });
}

async function revealByWheel(page:Page,frame:Locator,target:Locator){
  for(let step=0;step<30;step+=1){
    if(await isPainted(target))return;
    const bounds=await frame.boundingBox(),targetBounds=await target.boundingBox();
    expect(bounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();
    if(!bounds||!targetBounds)throw new Error('Book scroll frame or link has no layout');
    const previous=await frame.evaluate(element=>element.scrollTop);
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    await page.mouse.wheel(0,targetBounds.y<bounds.y?-480:480);
    await expect.poll(()=>frame.evaluate(element=>element.scrollTop)).not.toBe(previous);
  }
  await expect.poll(()=>isPainted(target)).toBe(true);
}

async function hiddenAncestorScroll(frame:Locator){
  return frame.evaluate(element=>{
    let largest=0;
    for(let parent=element.parentElement;parent;parent=parent.parentElement){
      if(getComputedStyle(parent).overflowY==='hidden')largest=Math.max(largest,Math.abs(parent.scrollTop));
    }
    return largest;
  });
}

test.use({storageState:{cookies:[],origins:[]}});

for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  test(`@smoke ready book HTML hydrates on direct entry at ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await preacceptCookies(page);
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{
      if(message.type()==='error'&&/(React error #418|hydrat)/i.test(message.text()))errors.push(message.text());
    });
    for(const slug of ['belarus','poland']){
      const response=await page.goto(`/books/${slug}`,{waitUntil:'domcontentloaded'});
      expect(response?.status()).toBe(200);
      await expect(page.locator('.rbe-dl-main')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test(`@smoke ready books own wheel scrolling and SPA visibility at ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await preacceptCookies(page);
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/books',{waitUntil:'domcontentloaded'});
    // The chooser follows the hero, and the mobile shortcut fits before scrolling (#3037).
    const catalog=page.locator('main.ready-books').filter({has:page.locator('.rbc-grid')});
    const catalogFrame=page.getByTestId('ready-books-scroll').filter({has:page.locator('.rbc-grid')});
    await expect(catalog).toBeVisible();
    if(viewport.width===390){
      await expect.poll(()=>isPainted(catalog.locator('a[href="#books-choose"]'))).toBe(true);
    }

    // Wheel input must reach the real links; scrollIntoView can move a hidden
    // navigation ancestor and conceal the missing user-scroll surface.
    for(const slug of ['belarus-graphic','poland-quests-1']){
      const link=catalog.locator(`.rbc-grid a[href="/books/${slug}"]`);
      await revealByWheel(page,catalogFrame,link);
      const previous=await catalogFrame.evaluate(element=>element.scrollTop);
      expect(previous).toBeGreaterThan(0);
      expect(await hiddenAncestorScroll(catalogFrame)).toBeLessThanOrEqual(1);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/books/${slug}(?:[?#]|$)`));
      // Card titles name «country · style» (#2953); the edition h1 keeps the book title.
      const heading=page.locator('.rbe-hero h1');
      const detail=page.locator('main.ready-books').filter({has:heading});
      await expect(detail.locator('.rbe-size input').first()).toBeAttached();
      await expect.poll(()=>isPainted(heading)).toBe(true);
      const detailFrame=page.getByTestId('ready-books-scroll').filter({has:heading});
      expect(await detailFrame.evaluate(element=>element.scrollTop)).toBeLessThanOrEqual(1);
      expect(await hiddenAncestorScroll(detailFrame)).toBeLessThanOrEqual(1);
      await page.screenshot({path:test.info().outputPath(`${slug}-visible.png`)});

      await page.goBack();
      await expect(page).toHaveURL(/\/books\/?(?:[?#]|$)/);
      await expect.poll(()=>catalogFrame.evaluate(element=>element.scrollTop)).toBeCloseTo(previous,0);
      await expect.poll(()=>isPainted(link)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
