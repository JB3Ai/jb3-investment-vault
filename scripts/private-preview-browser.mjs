/** Test helper only; the presentation PIN is never a Supabase credential. */
export async function enterPrivate(page,{skip=false,pin=process.env.JB3_LOCAL_PRESENTATION_PIN??'2323'}={}){
 await page.getByRole('button',{name:skip?'Skip intro':'Enter vault',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Enter your PIN'});await dialog.waitFor()
 await dialog.getByRole('textbox',{name:'Presentation PIN'}).count().then(async count=>{if(count)await dialog.getByRole('textbox',{name:'Presentation PIN'}).fill(pin);else await dialog.getByLabel('Presentation PIN',{exact:true}).fill(pin)})
 await dialog.getByRole('button',{name:'Enter',exact:true}).click();await page.getByRole('navigation',{name:'Section index'}).waitFor()
}
