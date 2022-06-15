package advantage.page.pages;

import org.openqa.selenium.By;

import advantage.page.elementos.ElementosWeb;
import advantage.page.metodos.MetodosDeTestes;

public class ExcluirContaPage {
	
	ElementosWeb elementos = new ElementosWeb();
	MetodosDeTestes metodos = new MetodosDeTestes();
	
	//elementos page tela inicial logado
	By myAccount = By.xpath("//*[@id=\"loginMiniTitle\"]/label[1]");	
	
	//elementos page tela My Account
	By DeleteAccount = By.xpath("//button[@class='deleteMainBtnContainer a-button ng-scope']");
	By buttonYesDelete = By.xpath("//*[@id=\"deleteAccountPopup\"]/div[3]/div[1]");
	By mensagemExcluido = By.xpath("//*[@class='deleteAccountPopupContent modificationTwo']");
	
	public void esperarCarregamentoSlow() throws InterruptedException {
		metodos.aguardarCarregamento(5000);
	}

	public void esperarCarregamentoFast() throws InterruptedException {
		metodos.aguardarCarregamento(3300);
	}
	
	
	public void clicarUserLogado() {
		metodos.clicar(elementos.getUserLogado());
	}
	
	public void clicarMyAccount() {
		metodos.clicar(myAccount);
	}
	
	public void clicarDeleteAccount() {
		metodos.clicar(DeleteAccount);
	}
	
	public void clicarYesDelete() {
		metodos.clicar(buttonYesDelete);
	}
	
	public void validarMensagemExclusao(String MsgContaExcluida) {
		metodos.validarTexto(mensagemExcluido, MsgContaExcluida);
	}

}
