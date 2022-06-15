package advantage.page.elementos;

import org.openqa.selenium.By;

public class ElementosWeb {
	
	//Classe para elementos que serão utilizados + de 1 vez
	
	private By user = By.xpath("//*[@id='menuUser']");
	
	private By userLogado = By.xpath("//a[@id='menuUserLink']");

	public By getUser() {
		return user;
	}

	public By getUserLogado() {
		return userLogado;
	}	

}
